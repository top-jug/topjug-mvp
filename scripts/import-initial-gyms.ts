import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { parse } from "csv-parse/sync";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { strFromU8, unzipSync } from "fflate";
import postgres from "postgres";
import {
  gymBrands,
  gymMedia,
  gymPrices,
  gyms,
  gymSources,
  mediaAssets,
} from "../src/server/db/schema";

const SOURCE_NAME = "topjug_initial_research_2026-08-23";
const DEFAULT_ARCHIVE = "../암장최초데이터베이스.zip";
const DEFAULT_LOGO_DIRECTORY = "../암장로고들";
const EXCLUDED_GYMS = new Set(["더클라임 신사"]);
const EXPECTED_RESEARCHED_GYMS = 32;
const EXPECTED_IMPORTED_GYMS = 31;
const EXPECTED_BRANDS = 7;

const requiredColumns = [
  "지점",
  "브랜드",
  "전화번호",
  "주소",
  "영업시간",
  "편의 시설",
  "주차 정보",
  "가격(일일권)",
  "신발대여",
  "인스타",
] as const;

type CsvRow = Record<(typeof requiredColumns)[number], string>;

function normalizedText(value: string | undefined) {
  return value?.replace(/\r\n/g, "\n").trim() ?? "";
}

function stableId(brand: string, location: string) {
  return createHash("sha256")
    .update(`${brand}\0${location}`)
    .digest("hex")
    .slice(0, 32);
}

function matchKey(value: string) {
  return value
    .normalize("NFC")
    .replaceAll("서울숲클라이밍", "서울숲")
    .replace(/점$/, "")
    .replace(/[^가-힣a-z0-9]/gi, "")
    .toLowerCase();
}

async function jpgFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return jpgFiles(path);
      return /\.jpe?g$/i.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

async function logoByExternalId(
  logoDirectory: string,
  rows: ReturnType<typeof parseRows>,
) {
  const files = await jpgFiles(logoDirectory);
  const matches = new Map<string, string>();
  for (const file of files) {
    const relativePath = relative(logoDirectory, file);
    const [folder] = relativePath.split(/[\\/]/);
    const fileKey = matchKey(basename(file, extname(file)));
    const folderKey = matchKey(folder);
    const candidates = rows.filter((row) => {
      const brandKey = matchKey(row.brand);
      const locationKey = matchKey(row.location);
      const branchKey = matchKey(row.branchName);
      return (
        folderKey === brandKey &&
        (fileKey === locationKey ||
          fileKey === branchKey ||
          fileKey.endsWith(branchKey))
      );
    });
    if (candidates.length !== 1)
      throw new Error(`Logo mapping is ambiguous for ${relativePath}.`);
    if (matches.has(candidates[0].externalId))
      throw new Error(`Multiple logos map to ${candidates[0].location}.`);
    matches.set(candidates[0].externalId, file);
  }
  return matches;
}

async function objectChecksum(s3: S3Client, bucket: string, key: string) {
  try {
    const object = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return object.Metadata?.sha256 ?? "";
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return undefined;
    throw error;
  }
}

async function connectionString() {
  let value = process.env.DATABASE_URL;
  if (!value) {
    const prefix = process.env.SSM_PARAMETER_PREFIX;
    if (!prefix) throw new Error("DATABASE_URL or SSM_PARAMETER_PREFIX is required unless --dry-run is used.");
    const normalizedPrefix = `/${prefix.split("/").filter(Boolean).join("/")}`;
    const name = `${normalizedPrefix}/runtime-database-url`;
    const ssm = new SSMClient({ region: process.env.AWS_REGION ?? "ap-northeast-2" });
    try {
      const response = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
      if (!response.Parameter?.Value) throw new Error(`Required SSM parameter is empty: ${name}`);
      value = response.Parameter.Value;
    } finally {
      ssm.destroy();
    }
  }
  const parsed = new URL(value);
  const productionTarget =
    process.env.APP_PROFILE === "production" ||
    process.env.SSM_PARAMETER_PREFIX?.split("/").includes("prod") ||
    parsed.hostname.endsWith(".rds.amazonaws.com");
  if (productionTarget && (parsed.protocol !== "postgresql:" || !["require", "verify-full"].includes(parsed.searchParams.get("sslmode") ?? ""))) {
    throw new Error("Production DATABASE_URL must use PostgreSQL with sslmode=require or verify-full.");
  }
  return value;
}

function instagramUrl(handle: string) {
  const normalized = handle
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/\/$/, "");
  return normalized ? `https://www.instagram.com/${normalized}/` : null;
}

function amountFromText(value: string) {
  const match = value.replaceAll(",", "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function facilitiesFromRow(row: CsvRow) {
  const values = normalizedText(row["편의 시설"])
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const facilities = new Set<string>();
  for (const value of values) {
    if (value.includes("샤워")) facilities.add("shower");
    else if (value.includes("스트레칭")) facilities.add("stretching_zone");
    else if (value.includes("주차")) facilities.add("parking");
  }
  if (normalizedText(row["신발대여"])) facilities.add("shoe_rental");
  return [...facilities];
}

function calendarColors(externalId: string) {
  const palette = [
    ["#2563EB", "#FFFFFF"],
    ["#0F766E", "#FFFFFF"],
    ["#7C3AED", "#FFFFFF"],
    ["#BE123C", "#FFFFFF"],
    ["#B45309", "#FFFFFF"],
    ["#4F46E5", "#FFFFFF"],
  ] as const;
  return palette[Number.parseInt(externalId.slice(0, 2), 16) % palette.length];
}

function csvFromNestedArchive(bytes: Uint8Array) {
  const outer = unzipSync(bytes);
  const nestedName = Object.keys(outer).find((name) =>
    name.toLowerCase().endsWith(".zip"),
  );
  if (!nestedName)
    throw new Error("The outer archive does not contain a nested ZIP file.");
  const nested = unzipSync(outer[nestedName]);
  const csvName =
    Object.keys(nested).find((name) =>
      name.toLowerCase().endsWith("_all.csv"),
    ) ??
    Object.keys(nested).find((name) => name.toLowerCase().endsWith(".csv"));
  if (!csvName)
    throw new Error("The nested archive does not contain a CSV file.");
  return { csvName, csv: strFromU8(nested[csvName]) };
}

function parseRows(csv: string) {
  const rows = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
  }) as CsvRow[];
  if (rows.length === 0) throw new Error("The CSV contains no gym rows.");
  for (const column of requiredColumns) {
    if (!(column in rows[0]))
      throw new Error(`Required CSV column is missing: ${column}`);
  }
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const location = normalizedText(row["지점"]);
    const brand = normalizedText(row["브랜드"]);
    const address = normalizedText(row["주소"]);
    if (!location || !brand || !address)
      throw new Error(`Row ${index + 2} requires 지점, 브랜드, and 주소.`);
    const externalId = stableId(brand, location);
    if (seen.has(externalId)) throw new Error(`Duplicate gym row: ${location}`);
    seen.add(externalId);
    const branchName = location.startsWith(`${brand} `)
      ? location.slice(brand.length + 1).trim()
      : location;
    const dayPassRaw = normalizedText(row["가격(일일권)"]);
    const shoeRentalRaw = normalizedText(row["신발대여"]);
    const [calendarColor, calendarTextColor] = calendarColors(externalId);
    return {
      externalId,
      location,
      brand,
      branchName,
      address,
      phone: normalizedText(row["전화번호"]) || null,
      instagramUrl: instagramUrl(normalizedText(row["인스타"])),
      operatingHoursNote: normalizedText(row["영업시간"]) || null,
      parkingInfo: normalizedText(row["주차 정보"]) || null,
      facilities: facilitiesFromRow(row),
      dayPass: dayPassRaw
        ? { amount: amountFromText(dayPassRaw), rawText: dayPassRaw }
        : null,
      shoeRental: shoeRentalRaw
        ? { amount: amountFromText(shoeRentalRaw), rawText: shoeRentalRaw }
        : null,
      calendarColor,
      calendarTextColor,
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const archiveArg =
    args.find((argument) => !argument.startsWith("--")) ?? DEFAULT_ARCHIVE;
  const logoDirectoryArg =
    args
      .find((argument) => argument.startsWith("--logo-dir="))
      ?.slice("--logo-dir=".length) ?? DEFAULT_LOGO_DIRECTORY;
  const archivePath = resolve(process.cwd(), archiveArg);
  const logoDirectory = resolve(process.cwd(), logoDirectoryArg);
  const { csvName, csv } = csvFromNestedArchive(await readFile(archivePath));
  const researchedRows = parseRows(csv);
  const rows = researchedRows.filter((row) => !EXCLUDED_GYMS.has(row.location));
  const logoFiles = await logoByExternalId(logoDirectory, rows);
  const missingLogos = rows
    .filter((row) => !logoFiles.has(row.externalId))
    .map((row) => row.location);

  const brandCount = new Set(rows.map((row) => row.brand)).size;
  if (researchedRows.length !== EXPECTED_RESEARCHED_GYMS)
    throw new Error(
      `Expected ${EXPECTED_RESEARCHED_GYMS} researched gyms, received ${researchedRows.length}.`,
    );
  if (rows.length !== EXPECTED_IMPORTED_GYMS) throw new Error(`Expected ${EXPECTED_IMPORTED_GYMS} imported gyms, received ${rows.length}.`);
  if (brandCount !== EXPECTED_BRANDS) throw new Error(`Expected ${EXPECTED_BRANDS} brands, received ${brandCount}.`);
  if (logoFiles.size !== EXPECTED_IMPORTED_GYMS) throw new Error(`Expected ${EXPECTED_IMPORTED_GYMS} logos, received ${logoFiles.size}.`);
  if (missingLogos.length > 0)
    throw new Error(`Missing logos: ${missingLogos.join(", ")}`);
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          archivePath,
          csvName,
          researchedGyms: researchedRows.length,
          excludedGyms: [...EXCLUDED_GYMS],
          gyms: rows.length,
          brands: brandCount,
          logos: logoFiles.size,
          missingLogos,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (!apply) throw new Error("Database import requires the explicit --apply flag.");
  const bucket = process.env.MEDIA_S3_BUCKET;
  if (!bucket)
    throw new Error("MEDIA_S3_BUCKET is required unless --dry-run is used.");
  const s3 = new S3Client({
    region: process.env.AWS_REGION ?? "ap-northeast-2",
    endpoint: process.env.MEDIA_S3_ENDPOINT,
    forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === "true",
  });
  const mediaPublicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL;
  if (!process.env.MEDIA_S3_ENDPOINT && (!mediaPublicBaseUrl || new URL(mediaPublicBaseUrl).protocol !== "https:")) {
    throw new Error("MEDIA_PUBLIC_BASE_URL must be an HTTPS URL when using AWS S3.");
  }
  const client = postgres(await connectionString(), { max: 1, connect_timeout: 10 });
  const database = drizzle(client);
  const uploadedLogoByExternalId = new Map<
    string,
    { storageKey: string; byteSize: number; checksumSha256: string }
  >();
  const now = new Date();
  let uploadedObjects = 0;
  let reusedObjects = 0;

  try {
    for (const [externalId, sourcePath] of logoFiles) {
      const body = await readFile(sourcePath);
      const storageKey = `gyms/initial/${externalId}/logo.jpg`;
      const checksumSha256 = createHash("sha256").update(body).digest("hex");
      const existingChecksum = await objectChecksum(s3, bucket, storageKey);
      if (existingChecksum !== undefined && existingChecksum !== checksumSha256) {
        throw new Error(`S3 object checksum mismatch for ${storageKey}; use a new key for changed media.`);
      }
      if (existingChecksum === undefined) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: body,
            ContentType: "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable",
            Metadata: { source: SOURCE_NAME, sha256: checksumSha256 },
          }),
        );
        uploadedObjects += 1;
      } else {
        reusedObjects += 1;
      }
      uploadedLogoByExternalId.set(externalId, {
        storageKey,
        byteSize: body.byteLength,
        checksumSha256,
      });
    }
    const { summary, sharedAssetSummary } = await database.transaction(async (transaction) => {
      for (const row of rows) {
        const [brand] = await transaction
          .insert(gymBrands)
          .values({ name: row.brand })
          .onConflictDoUpdate({
            target: gymBrands.name,
            set: { updatedAt: now },
          })
          .returning({ id: gymBrands.id });
        const [existingSource] = await transaction
          .select({ gymId: gymSources.gymId })
          .from(gymSources)
          .where(
            and(
              eq(gymSources.sourceName, SOURCE_NAME),
              eq(gymSources.externalId, row.externalId),
            ),
          )
          .limit(1);
        let gymId = existingSource?.gymId;
        if (gymId) {
          await transaction
            .update(gyms)
            .set({
              brandId: brand.id,
              name: row.location,
              branchName: row.branchName,
              address: row.address,
              phone: row.phone,
              instagramUrl: row.instagramUrl,
              operatingHoursNote: row.operatingHoursNote,
              parkingInfo: row.parkingInfo,
              facilities: row.facilities,
              calendarColor: row.calendarColor,
              calendarTextColor: row.calendarTextColor,
              updatedAt: now,
            })
            .where(eq(gyms.id, gymId));
        } else {
          const [gym] = await transaction
            .insert(gyms)
            .values({
              brandId: brand.id,
              name: row.location,
              branchName: row.branchName,
              address: row.address,
              phone: row.phone,
              instagramUrl: row.instagramUrl,
              operatingHoursNote: row.operatingHoursNote,
              parkingInfo: row.parkingInfo,
              facilities: row.facilities,
              calendarColor: row.calendarColor,
              calendarTextColor: row.calendarTextColor,
            })
            .returning({ id: gyms.id });
          gymId = gym.id;
        }

        await transaction
          .insert(gymSources)
          .values({
            gymId,
            type: "public_data",
            sourceName: SOURCE_NAME,
            externalId: row.externalId,
            lastCheckedAt: now,
            metadata: { importFile: csvName, needsReview: true },
          })
          .onConflictDoUpdate({
            target: [gymSources.sourceName, gymSources.externalId],
            set: {
              gymId,
              lastCheckedAt: now,
              metadata: { importFile: csvName, needsReview: true },
            },
          });

        for (const [type, price] of [
          ["day_pass", row.dayPass],
          ["shoe_rental", row.shoeRental],
        ] as const) {
          if (!price) {
            await transaction
              .delete(gymPrices)
              .where(and(eq(gymPrices.gymId, gymId), eq(gymPrices.type, type)));
            continue;
          }
          await transaction
            .insert(gymPrices)
            .values({
              gymId,
              type,
              amount: price.amount,
              rawText: price.rawText,
            })
            .onConflictDoUpdate({
              target: [gymPrices.gymId, gymPrices.type],
              set: {
                amount: price.amount,
                rawText: price.rawText,
                updatedAt: now,
              },
            });
        }

        const existingRoles = await transaction
          .select({ type: gymMedia.type })
          .from(gymMedia)
          .where(eq(gymMedia.gymId, gymId));
        if (["logo", "cover", "photo"].every((type) => existingRoles.some((media) => media.type === type))) continue;

        const logo = uploadedLogoByExternalId.get(row.externalId)!;
        const [existingAsset] = await transaction
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(eq(mediaAssets.storageKey, logo.storageKey))
          .limit(1);
        const asset =
          existingAsset ??
          (
            await transaction
              .insert(mediaAssets)
              .values({
                storageKey: logo.storageKey,
                contentType: "image/jpeg",
                byteSize: logo.byteSize,
                checksumSha256: logo.checksumSha256,
                status: "ready",
                readyAt: now,
              })
              .returning({ id: mediaAssets.id })
          )[0];
        if (existingAsset) {
          await transaction
            .update(mediaAssets)
            .set({
              contentType: "image/jpeg",
              byteSize: logo.byteSize,
              checksumSha256: logo.checksumSha256,
              status: "ready",
              readyAt: now,
              deletedAt: null,
            })
            .where(eq(mediaAssets.id, existingAsset.id));
        }

        for (const [type, altText] of [
          ["logo", `${row.location} 로고`],
          ["cover", `${row.location} 대표 이미지`],
          ["photo", `${row.location} 상세 이미지`],
        ] as const) {
          if (existingRoles.some((media) => media.type === type)) continue;
          await transaction.insert(gymMedia).values({
            gymId,
            mediaAssetId: asset.id,
            type,
            altText,
            sortOrder: 0,
          });
        }
      }
      const [summary] = await transaction.execute<{
        gyms: number;
        brands: number;
        assets: number;
        logos: number;
        covers: number;
        photos: number;
      }>(sql`
        select
          count(distinct source.gym_id)::int as gyms,
          count(distinct gym.brand_id)::int as brands,
          count(distinct asset.id)::int as assets,
          count(*) filter (where media.type = 'logo')::int as logos,
          count(*) filter (where media.type = 'cover')::int as covers,
          count(*) filter (where media.type = 'photo')::int as photos
        from gym_sources source
        join gyms gym on gym.id = source.gym_id
        join gym_media media on media.gym_id = source.gym_id
        join media_assets asset on asset.id = media.media_asset_id and asset.status = 'ready'
        where source.source_name = ${SOURCE_NAME}
      `);
      const [sharedAssetSummary] = await transaction.execute<{ gyms: number }>(sql`
        select count(*)::int as gyms from (
          select media.gym_id
          from gym_sources source
          join gym_media media on media.gym_id = source.gym_id
          where source.source_name = ${SOURCE_NAME} and media.type in ('logo', 'cover', 'photo')
          group by media.gym_id
          having count(*) filter (where media.type = 'logo') = 1
            and count(*) filter (where media.type = 'cover') = 1
            and count(*) filter (where media.type = 'photo') = 1
            and count(distinct media.media_asset_id) = 1
        ) verified
      `);
      const expected = EXPECTED_IMPORTED_GYMS;
      if (
        summary.gyms !== expected ||
        summary.brands !== EXPECTED_BRANDS ||
        summary.assets !== expected ||
        summary.logos !== expected ||
        summary.covers !== expected ||
        summary.photos !== expected ||
        sharedAssetSummary.gyms !== expected
      ) {
        throw new Error(`Post-import verification failed: ${JSON.stringify({ ...summary, sharedAssetGyms: sharedAssetSummary.gyms })}`);
      }
      return { summary, sharedAssetSummary };
    });
    console.log(JSON.stringify({
      event: "initial_gym_import_completed",
      source: SOURCE_NAME,
      csvName,
      ...summary,
      sharedAssetGyms: sharedAssetSummary.gyms,
      uploadedObjects,
      reusedObjects,
    }));
  } finally {
    await client.end();
    s3.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
