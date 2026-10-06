/** Error text under a field; link it to the input with aria-describedby={id}. */
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-body-sm text-error">
      {message}
    </p>
  );
}
