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
    date   : string;
    title  : string;
    href   : string;
    tests  : SectionTests[];
}

/**
 * Information necessary to run the report generation
 */
interface TestBlock {
    /** relative file name to the index.json file describing the tests */
    test_index: string,
    /** relative file name to the index.json file describing the implementations */
    impl_index: string,
    /** prefix to be used to find the right HTML Elements */
    prefix: string
}

/**
 * Display a group of tests in HTML (corresponding to a document) as separate sections. Also, generate a list of score objects. Essentially,
 * combine the general test descriptions with the accumulated scores of implementations.
 *
 *
 * @param group_section_dom - The HTML element (section) where the test descriptions should go
 * @param document_tests - An object representing a series of tests, plus some metadata
 * @param implementations - List of implementation result objects
 * @param test_index - the reference to the test_index file; used to generate the URLs for the tests themselves
 * @returns - list of test scores
 */
function display_test_groups(group_section_dom: HTMLElement, document_tests: DocumentTests, implementations: Implementation[], test_index: string): TestScore[] {
    const add_item = (parent: HTMLElement, label: string, content: string): void => {
        const dt: HTMLElement = document.createElement('dt');
        dt.textContent = label;
        parent.append(dt);
        const dd: HTMLElement = document.createElement('dd');
        dd.innerHTML = content;
        parent.append(dd);
    };

    const base_components: string[] = test_index.split('/');
    const preamble: string[] = base_components.slice(0, base_components.length - 1);

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

            let format: string;
            if (test["media-type"]) {
                switch (test["media-type"]) {
                    case "text/html" : 
                        format = 'html'
                        break;
                    case "application/ld+json" :
                        format = 'jsonld'
                        break;
                    case "application/lpf+zip" :
                        format = 'lpf'
                        break;
                    default:
                        format = "n/a"
                }
            } else {
                format = "n/a"
            }

            const fname: string  = `${test.id}.${format}`;
            const fileref: string = [...preamble, fname].join('/');

            const dl: HTMLElement = document.createElement('dl');
            add_item(dl, 'Description:', test.description);
            add_item(dl, 'Expected action(s):', test.actions);
            add_item(dl, 'Expected errors:', test.errors);
            add_item(dl, 'Test file format:', format);
            if (format !== 'n/a') {
                add_item(dl, 'Source code:', `See <a href="${fileref}">${fname}</a>.`);
            }
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
 * @param prefix - string to prefix the generic `id` attribute of the target element
 */
function display_implementations(implementations: Implementation[], prefix: string): void {
    const description: HTMLElement = document.getElementById(`${prefix}_implementations`);

    implementations.forEach((impl: Implementation): void => {
        // Expand the description
        const dl: HTMLElement = document.createElement('dt');
        dl.innerText = impl.$name;
        description.append(dl);

        const dd: HTMLElement = document.createElement('dd');
        let descr = `${impl.$description}`;
        if (impl.$href !== undefined) {
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
 * @param prefix - string to prefix the generic `id` attribute of the target element
 */
function display_scores(scores: TestScore[], implementations: Implementation[], prefix: string): void {
    // First step: expand the header fields, as well as the generic description with the list of available implementations
    const header_row: HTMLElement = document.getElementById(`${prefix}_header_row`);
    implementations.forEach((impl: Implementation): void => {
        // Expand the table header
        const th: HTMLElement = document.createElement('th');
        th.textContent = impl.$name;
        header_row.append(th);
    });

    // Go through each test to set a new row
    const table_body: HTMLElement = document.getElementById(`${prefix}_table_body`);
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


async function display_test_suite(test_block: TestBlock) {
    try {
        const {test_index, impl_index, prefix} = test_block;  

        const tests = await get_json(test_index);
        const implementations = await get_implementations(impl_index);

        const test_listing = document.getElementById(`${prefix}_tests`);
        const scores = display_test_groups(test_listing, tests, implementations, test_index);

        display_scores(scores, implementations, prefix);
        display_implementations(implementations, prefix);
    } catch(e) {
        alert(`${e.message}, ${e.name}`);
    }
}
