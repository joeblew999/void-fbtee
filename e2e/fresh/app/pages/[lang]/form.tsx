// Void's docs example of useForm (guide/pages-routing/actions-and-forms.md), as written: the
// field's error is shown as Void gives it. The language is passed by hand, as every address needs
// today (plans/quiet-harbor-atlas.md, step 3).
import { Form, useForm } from "@void/react";
import { useLocale } from "void-fbtee/react";

export default function CreateUser() {
  const { lang } = useLocale();
  const form = useForm("/[lang]/form", { name: "" }, { params: { lang } });
  return (
    <Form form={form}>
      <input
        name="name"
        value={form.data.name}
        onChange={(e) => form.setData("name", e.target.value)}
      />
      {form.errors.name && <span data-testid="error-name">{form.errors.name}</span>}
      <button>Create</button>
    </Form>
  );
}
