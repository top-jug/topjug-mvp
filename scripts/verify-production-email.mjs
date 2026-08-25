import {
  GetAccountCommand,
  GetEmailIdentityCommand,
  SendEmailCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';

function requiredEmailAddress() {
  const value = process.env.EMAIL_FROM_ADDRESS?.trim().toLowerCase() ?? '';
  const separator = value.lastIndexOf('@');
  if (separator <= 0 || separator === value.length - 1 || value.length > 254) {
    throw new Error('EMAIL_FROM_ADDRESS must be a valid email address.');
  }
  return value;
}

async function main() {
  const region = process.env.AWS_REGION ?? 'ap-northeast-2';
  const fromEmailAddress = requiredEmailAddress();
  const identityDomain = process.env.EMAIL_IDENTITY_DOMAIN?.trim().toLowerCase()
    ?? fromEmailAddress.slice(fromEmailAddress.lastIndexOf('@') + 1);
  const client = new SESv2Client({ region });

  const [account, identity] = await Promise.all([
    client.send(new GetAccountCommand({})),
    client.send(new GetEmailIdentityCommand({ EmailIdentity: identityDomain })),
  ]);

  if (account.ProductionAccessEnabled !== true) {
    throw new Error(`Amazon SES production access is not enabled in ${region}.`);
  }
  if (identity.VerificationStatus !== 'SUCCESS') {
    throw new Error(`Amazon SES identity ${identityDomain} is not verified.`);
  }
  if (identity.DkimAttributes?.SigningEnabled !== true || identity.DkimAttributes.Status !== 'SUCCESS') {
    throw new Error(`Amazon SES DKIM for ${identityDomain} is not ready.`);
  }

  await client.send(new SendEmailCommand({
    FromEmailAddress: fromEmailAddress,
    Destination: { ToAddresses: ['success@simulator.amazonses.com'] },
    Content: {
      Simple: {
        Subject: { Data: 'TopJug deployment email check', Charset: 'UTF-8' },
        Body: { Text: { Data: 'Production email delivery preflight succeeded.', Charset: 'UTF-8' } },
      },
    },
  }));

  console.info(JSON.stringify({
    event: 'production_email.preflight_succeeded',
    region,
    identityDomain,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'production_email.preflight_failed',
    error: error instanceof Error ? error.message : 'Unknown error',
  }));
  process.exitCode = 1;
});
