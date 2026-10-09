import { PasswordInput } from "./PasswordInput";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  return (
    <form action="/api/login" method="post" className="mx-auto mt-16 max-w-xs space-y-3 rounded-lg border border-stone-200 bg-white p-5">
      <h1 className="font-semibold">Aangan Enquiry Desk</h1>
      <PasswordInput />
      {sp.error && <p className="text-xs text-red-700">Wrong password.</p>}
      <button className="w-full rounded bg-emerald-900 py-1.5 font-medium text-white">Sign in</button>
    </form>
  );
}
