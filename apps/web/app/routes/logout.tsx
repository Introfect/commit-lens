import { redirect, Form } from "react-router-dom";
import type { ActionFunction } from "react-router-dom";

export const action: ActionFunction = async () => {
  // In a real app, you'd make an API call to your backend to invalidate the session.
  // For now, we'll just redirect to the landing page.
  return redirect("/");
};

export default function LogoutPage() {
  return (
    <div className="p-4">
      <p>Logging you out...</p>
      <Form method="post">
        <button type="submit">Logout</button>
      </Form>
    </div>
  );
}
