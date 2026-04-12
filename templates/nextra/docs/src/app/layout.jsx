import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
	title: "Docs",
};

const navbar = <Navbar logo={<b>Docs</b>} />;
const footer = (
	<Footer>MIT {new Date().getFullYear()} © Your Project.</Footer>
);

export default async function RootLayout({ children }) {
	return (
		<html lang="en" dir="ltr" suppressHydrationWarning>
			<Head />
			<body>
				<Layout
					navbar={navbar}
					pageMap={await getPageMap()}
					footer={footer}
				>
					{children}
				</Layout>
			</body>
		</html>
	);
}
