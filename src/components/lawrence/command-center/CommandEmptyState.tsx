export function CommandEmptyState({ message }: { message?: string }) {
  return <p className="muted">{message ?? "No critical work. Enjoy the silence while it lasts."}</p>;
}
