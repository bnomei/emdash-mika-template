# Vendored packages

`@bnomei/emdash-mika` is kept here as an npm package archive so this template
can build in isolated deployment environments without its development sibling
checkout or private Git credentials.

Refresh it from the sibling repository with:

```sh
npm pack ../emdash-mika --ignore-scripts --pack-destination vendor
```
