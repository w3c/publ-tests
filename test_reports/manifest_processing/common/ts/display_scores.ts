/* eslint-disable no-unused-vars */
/* eslint-disable no-alert */
/* eslint-env browser */

'use strict';

/**
 * Retrieve a JSON file.
 *
 * @async
 * @param {string} fname - JSON file name
 * @return {Promise<object>} - the parsed JSON content
 */
async function get_json(fname: string): Promise<any> {
    try {
        return fetch(fname).then((response) => response.json());
    } catch(err) {
        throw new Error(`problem accessing remote file ${fname}: ${err.message}`);
    };
}

/**
 * Retrieve all implementation files and return an array of the parsed objects, referred to as
 * "implementation object". See the `results/index.json` file
 * for the details of the index files, and the rest of the files for the structure of the scores' objects.
 *
 * @async
 * @param impl_index - file name for the implementation index file
 * @return {Promise<object[]>} - all implementation objects (parsed version of the implementation files)
 */
async function get_implementations(impl_index: string): Promise<Implementation[]> {
    // Get the list of implementations first
    const impl_names: string[] = await get_json(impl_index);

    // The list of implementation names must be converted into relative file names v.a.v. the HTML report page
    const index_components: string[] = impl_index.split('/');
    const preamble: string[] = index_components.slice(0, index_components.length - 1);
    const impl_files: string[] = impl_names.map((name: string): string => [...preamble, `${name}.json`].join('/'));

    // Instead of a cycle with waits, let us be more elegant and issue the file fetches concurrently...
    // 'fetches' becomes an an array of Promises!
    const fetches: Promise<Implementation>[] = impl_files.map((fname) => get_json(fname));
    const implementations: Implementation[] = await Promise.all(fetches);
    return implementations;
}

/* ----------------------------------------------------------------------------------- */
/* Types used by the functions                                                         */
/* ----------------------------------------------------------------------------------- */

/**
 * One line in the table row: scores for a specific test
 */
interface TestScore {
    id          : string;
    description : string;
    scores      : boolean[];
}

/**
 * Implementation: this is the type of the result object submitted by an implementation 
 */
interface Implementation {
    $name           : string;
    $description    : string;
    $href?          : string;
    [index: string] : boolean | string;
}

/**
 * A single test
 */
interface Test {
    id           : string;
    description  : string;
    actions      : string;
    errors       : string;
    format?      : string;
    "media-type"?: string;
}

/**
 * Collection of the tests for a document section
 */
interface SectionTests {
    section  : string;
    href     : string;
    tests    : Test[];
}

/**
 * All tests for a document
 */
interface DocumentTests {
    title  : string;
    href   : string;
    tests  : SectionTests[];
}

/**
 * Display a group of tests in HTML (corresponding to a document) as separate sections. Also, generate a list of score objects. Essentially,
 * combine the general test descriptions with the accumulated scores of implementations.
 *
 *
 * @param group_section_dom - The HTML element (section) where the test descriptions should go
 * @param document_tests - An object representing a series of tests, plus some metadata
 * @param implementations - List of implementation result objects
 * @returns - list of test scores
 */
function display_test_groups(group_section_dom: HTMLElement, document_tests: DocumentTests, implementations: Implementation[]): TestScore[] {
    const add_item = (parent: HTMLElement, label: string, content: string): void => {
        const dt: HTMLElement = document.createElement('dt');
        dt.textContent = label;
        parent.append(dt);
        const dd: HTMLElement = document.createElement('dd');
        dd.innerHTML = content;
        parent.append(dd);
    };

    const document_scores: TestScore[] = [];
    document_tests.tests.forEach((section_tests: SectionTests) => {
        // Tests are grouped by 'sections', referring to the relevant section of the spec
        const spec_section_dom: HTMLElement = document.createElement('section');
        group_section_dom.append(spec_section_dom);

        // Give a header referring to that section
        const h4: HTMLElement = document.createElement('h4');
        h4.innerHTML = `Tests for “${section_tests.section}”`;
        spec_section_dom.append(h4);

        const p: HTMLElement = document.createElement('p');
        p.innerHTML = `See <a href="${section_tests.href}">the specification</a> for the relevant section.`;
        spec_section_dom.append(p);

        // The individual tests are in an array:
        section_tests.tests.forEach((test: Test) => {
            const test_section_dom: HTMLElement = document.createElement('section');
            test_section_dom.id = test.id;
            spec_section_dom.append(test_section_dom);

            const h5: HTMLElement = document.createElement('h5');
            h5.innerHTML = `Test "${test.id}"`;
            test_section_dom.append(h5);

            const format: string = test["media-type"] === "text/html" ? 'html' : 'jsonld';
            const fname: string  = `test_${test.id}.${format}`;
            const fileref: string = test.id.startsWith('m') ? `./tests/generic/${fname}` : `./tests/audiobooks/${fname}`;

            const dl: HTMLElement = document.createElement('dl');
            add_item(dl, 'Description:', test.description);
            add_item(dl, 'Expected action(s):', test.actions);
            add_item(dl, 'Expected errors:', test.errors);
            add_item(dl, 'Test file format:', format === 'html' ? 'html' : 'json-ld');
            add_item(dl, 'Source code:', `See <a href="${fileref}">${fname}</a>.`);
            test_section_dom.append(dl);

            // Filling in the values for the table data for that specific test
            const scores: boolean[] = implementations.map((impl: Implementation): boolean => {
                if (impl[test.id] === undefined) {
                    return null;
                } else {
                    return impl[test.id] as boolean;
                }
            });
            document_scores.push({
                id          : test.id,
                description : test.description,
                scores
            });
        });
    });
    return document_scores;
}


/**
 * Add the description of each implementation to the preamble text.
 *
 * @param implementations - array of implementation objects.
 */
function display_implementations(implementations: Implementation[]): void {
    const description: HTMLElement = document.getElementById('implementations');

    implementations.forEach((impl: Implementation): void => {
        // Expand the description
        const dl: HTMLElement = document.createElement('dt');
        dl.innerText = impl.$name;
        description.append(dl);

        const dd: HTMLElement = document.createElement('dd');
        let descr = `${impl.$description}`;
        if (impl.$ref !== undefined) {
            descr = `${descr} (<a href="${impl.$href}">Click here for further details</a>.)`;
        }
        dd.innerHTML = `${descr}`;
        description.append(dd);
    });
}


/**
 * Add the score values to the result table.
 *
 * @param scores - array of score objects, each representing a row in the result table.
 * @param implementations - array of implementation objects; used to add the right headers in the table.
 */
function display_scores(scores: TestScore[], implementations: Implementation[]): void {
    // First step: expand the header fields, as well as the generic description with the list of available implementations
    const header_row: HTMLElement = document.getElementById('header_row');
    implementations.forEach((impl: Implementation): void => {
        // Expand the table header
        const th: HTMLElement = document.createElement('th');
        th.textContent = impl.$name;
        header_row.append(th);
    });

    // Go through each test to set a new row
    const table_body: HTMLElement = document.getElementById('table_body');
    let number: number = 1;
    scores.forEach((item: TestScore) => {
        const tr: HTMLElement = document.createElement('tr');
        table_body.append(tr);

        const td_num: HTMLElement = document.createElement('td');
        // eslint-disable-next-line no-plusplus
        td_num.innerText = `${number++}`;
        tr.append(td_num);

        const td_id: HTMLElement = document.createElement('td');
        td_id.innerHTML = `<a href="#${item.id}">${item.id}</a>`;
        tr.append(td_id);

        const td_descr: HTMLElement = document.createElement('td');
        td_descr.innerText = item.description;
        tr.append(td_descr);

        item.scores.forEach((score: boolean): void => {
            const td_score = document.createElement('td');
            let css_class = 'na';
            let value = 'n/a';
            if (score !== null) {
                css_class = (score === true) ? 'pass' : 'fail';
                value = css_class;
            }
            td_score.innerText = value;
            td_score.setAttribute('class', css_class);
            tr.append(td_score);
        });
    });
}
