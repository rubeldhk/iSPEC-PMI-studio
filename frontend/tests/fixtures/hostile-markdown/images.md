# Images

A remote image that must never be fetched:

![a remote tracker](https://tracker.test/pixel.gif)

A data-URL image:

![an inline image](data:image/svg+xml;base64,PHN2Zy8+)

A frame, an object and an embed:

<iframe src="https://evil.test/frame"></iframe>
<object data="https://evil.test/object"></object>
<embed src="https://evil.test/embed">

A raw image tag with an error handler:

<img src="https://tracker.test/other.gif" alt="raw tag" onerror="window.__pwned = true">
