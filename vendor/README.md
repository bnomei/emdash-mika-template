# Vendored packages

`@bnomei/emdash-mika` is kept here as an npm package archive so this template
can build in isolated deployment environments without its development sibling
checkout or private Git credentials.

The current dependency is `bnomei-emdash-mika-0.2.0.tgz`, the supplied integration
archive from uncommitted Mika source, not the registry or `origin/main`.
Its SHA-256 is `b4fd1a975553b3256c3c4954437cafcf405bda76038c2ce1e95f6baec25e1a5e`
(634108 bytes). Keep the archive and package lock in sync when refreshing it.

For a future source refresh, pack the intended sibling checkout with:

```sh
npm pack ../emdash-mika --ignore-scripts --pack-destination vendor
```
