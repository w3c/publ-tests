# Subfolder content:

- `index.html`: The reporting page, generating a human-readable report for all implementations.
- `tests`: The test suite. The index file for the test suite is [index.json](./tests/index.json), describing each individual test manifests.
- `tests/generic` and `tests/audiobooks`: the test manifests themselves, for the generic case (i.e., for Publication Manifests in general), and, respectively, the tests for the audiobooks case
- `results`: Submitted test results, one per implementers. See [online description](https://w3c.github.io/publ-tests/APITests/#section_3) for more details.
- `common`: The run-time code for the report page:
  - `common/ts`: the original Typescript code.
  - `common/js`: the generated Javascript code, as used by the reporting page, as well as the separate code to generate a table of content. The generation of the code can be done via a standard typescript processing.
  - `common/css`: the CSS file used by the report page.
  
The report page can be [seen online](https://w3c.github.io/publ-tests/APITests/).

