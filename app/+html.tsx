import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Reed</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#121110" />
        <meta name="description" content="Reed. Your coach for everything you do with your body." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Reed" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {process.env.NODE_ENV === 'production' ? <script defer src="/register-sw.js" /> : null}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Raw CSS as an escape-hatch so the background never flashes light before the app mounts. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

// Reed is dark only: the canvas colour (design/system.ts) paints the page before JS runs.
const responsiveBackground = `
html,
body,
#root {
  background-color: #121110;
  min-height: 100%;
}

body {
  overflow: hidden;
}

#root {
  isolation: isolate;
}`;
