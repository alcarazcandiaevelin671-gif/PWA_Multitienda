/**
 * [PÁGINA] Envoltorio de cada página que aplica la animación de entrada (.page-transition).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}