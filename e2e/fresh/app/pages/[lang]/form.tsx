// Void's docs example of useForm (guide/pages-routing/actions-and-forms.md), as written, with
// void-fbtee's useForm, which fills in the page's language: the field's error is shown as Void
// gives it.
import { Form } from "@void/react";
import { useForm } from "void-fbtee/react";

export default function CreateUser() {
  const form = useForm("/[lang]/form", { name: "" });
  return (
    <Form form={form}>
      <input
        name="name"
        value={form.data.name}
        onChange={(e) => form.setData("name", e.target.value)}
      />
      {form.errors.name && <span data-testid="error-name">{form.errors.name}</span>}
      <button>
        <fbt desc="Button: post the new event">Post it</fbt>
      </button>
    </Form>
  );
}
