import { PageWidth } from "@/components/layout/PageWidth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PageWidth size="reading">{children}</PageWidth>;
}
