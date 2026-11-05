import './globals.css';

export const metadata = {
    title: 'Life in Weeks',
    description: 'Your life, one box per week, with your photos and moments'
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
