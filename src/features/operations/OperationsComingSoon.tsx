import { Construction } from 'lucide-react';

export function OperationsComingSoon({ title }: { title: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <Construction aria-hidden="true" className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">운영 콘솔 기반 이후의 별도 이슈에서 실제 조회와 변경 기능을 연결합니다.</p>
    </section>
  );
}
