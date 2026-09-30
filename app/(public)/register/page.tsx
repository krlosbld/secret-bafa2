import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/userSession";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "Créer mon compte — BafaPilot" };

export default async function RegisterPage() {
  if (await getVerifiedUser()) redirect("/sessions");
  return <RegisterForm />;
}
