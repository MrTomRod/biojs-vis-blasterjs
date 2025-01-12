/*
 * biojs-vis-blasterjs
 * https://github.com/sing-group/blasterjs
 *
 * Copyright (c) 2018 SING - Sistemas Informaticos de Nueva Generacion
 * Licensed under the MIT license.
 *
 *
 * BlasterJS
 *
 * @class
 * @extends Biojs
 *
 * @author <a href="mailto:aiblanco@uvigo.es">Aitor Blanco Miguez</a>
 * @version 1.1.3
 * @category 3
 *
 * @requires Bootstrap 3
 * @dependency <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" integrity="sha384-1q8mTJOASx8j1Au+a5WDVnPi2lkFfwwEAa8hDDdjZlpLegxhjVME1fgjWPGmkzs7" crossorigin="anonymous"></link>
 *
 * @requires <a href='html2canvas.js'>HTML2CANVAS</a>
 * @dependency <script type="text/javascript" src="lib/html2canvas.js"></script>
 *
 *
 * @param {Object} options An object with the options for BlasterJS component.
 *
 * @option {string} input
 *    Identifier of the INPUT tag where the BLAST output file should be selected.
 *
 * @option {string} multipleAlignments
 *    Identifier of the DIV tag where the multiple alignments should be displayed.
 *
 * @option {string} alignmentsTable
 *    Identifier of the DIV tag where the alignments table should be displayed.
 *
 * @option {string} singleAlignment
 *    Identifier of the DIV tag where the single should be displayed.
 * 
 * @example
 * const instance = new Biojs.blasterjs({
 *      input: "blastinput",
 *      multipleAlignments: "blast-multiple-alignments",
 *      alignmentsTable: "blast-alignments-table",
        singleAlignment: "blast-single-alignment"
 * });
 */


let blasterjs;
let Class = require('js-class');
module.exports = blasterjs = Class(/** @lends Biojs.blasterjs# */
    {
        constructor: function (options) {
            const self = this;

            require('js-extend').extend(this.opt, options);

            const css = 'table tbody tr td button:hover{ text-decoration: underline;}';
            const style = document.createElement('style');
            if (style.styleSheet) {
                style.styleSheet.cssText = css;  // IE8 and below
            } else {
                style.appendChild(document.createTextNode(css));
            }
            document.getElementsByTagName('head')[0].appendChild(style);
            if (self.opt.string) {
                const myBlob = new Blob([self.opt.string], {type: "text/plain"});
                const fakeEvent = {
                    target: {files: [myBlob]}
                };
                self._displayAlignments(fakeEvent, self);
            } else {
                document.getElementById(self.opt.input).addEventListener('change', function (evt) {
                    self._displayAlignments(evt, self)
                }, false);
            }
        },

        /**
         * Default values for the options
         * @name Biojs.blasterjs-opt
         */
        opt: {
            input: "blastinput",
            multipleAlignments: "blast-multiple-alignments",
            alignmentsTable: "blast-alignments-table",
            singleAlignment: "blast-single-alignment"
        },

        /**
         * Private: Read and display BLAST alignments.
         * @ignore
         */
        _displayAlignments: function (evt, self) {
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                const f = evt.target.files[0];
                if (f) {
                    const r = new FileReader();
                    r.onload = function (e) {
                        try {
                            const queries = getQueries(e.target.result);
                            const alignments = getAlignments(queries[0]);
                            const queryLength = getQueryLength(queries[0]);
                            if (alignments.length === 0) {
                                createEmptyAlignmentComparison(queries, [], 0, queryLength, true, true, self);
                            } else {
                                const hsps = alignments[0].hsp.length;
                                createAlignmentComparison(queries, hsps, 0, alignments, queryLength, true, true, self);
                                createAlignmentTable(alignments, self);
                                createSingleAlignment(alignments[0], self, hsps, 0);
                            }
                        } catch (err) {
                            const divs = ["blast-multiple-alignments", "blast-alignments-table", "blast-single-alignment"];
                            for (let i = 0; i < divs.length; i++) {
                                const div = document.getElementById(divs[i]);
                                while (div.firstChild) {
                                    div.removeChild(div.firstChild);
                                }
                            }
                            console.error(err)
                            alert('ERROR WHILE UPLOADING DATA: You have uploaded an invalid BLAST output file.');
                        }
                    }
                    r.readAsText(f);
                } else {
                    alert('ERROR WHILE UPLOADING DATA: Failed to load file.');
                }
            } else {
                alert('The File APIs are not fully supported by your browser.');
            }

            function BlastAlignment(description, length, totalScore, queryCover, hsp) {
                this.description = description;
                this.length = length;
                this.totalScore = totalScore;
                this.queryCover = queryCover;
                this.hsp = hsp;
            }

            function HSP(score, eValue, identities, positives, gaps, queryStart, query, queryEnd, comparison, subjectStart, subject, subjectEnd) {
                this.score = score;
                this.eValue = eValue;
                this.identitiesRel = (100 * identities[0] / identities[1]).toFixed(1) + '%';
                this.identitiesFraction = `${identities[0]}/${identities[1]}`;
                this.positives = positives;
                this.gaps = gaps;
                this.queryStart = queryStart;
                this.query = query;
                this.queryEnd = queryEnd;
                this.comparison = comparison;
                this.subjectStart = subjectStart;
                this.subject = subject;
                this.subjectEnd = subjectEnd;
            }

            String.prototype.startsWith = function (prefix) {
                return this.indexOf(prefix) === 0;
            }

            function getQueries(content) {
                const lines = content.split('\n');
                if (lines[2].startsWith("<BlastOutput>")) {
                    return getXMLQueries(content);
                } else {
                    return getTextQueries(content);
                }
            }

            function getXMLQueries(content) {
                const queries = [];
                const lines = content.split('\n').map(line => line.trim());
                let count = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('<Iteration>')) {
                        count++;
                    }
                }
                if (count === 1) {
                    queries.push(content);
                } else {
                    let j = 0;
                    let init = '';
                    for (let i = 0; i < lines.length; i++) {
                        j = i;
                        if (lines[i].startsWith('<Iteration>')) {
                            break;
                        } else {
                            init = init + lines[i] + '\n';
                        }
                    }
                    for (let x = 0; x < count; x++) {
                        let query = init + lines[j] + '\n';
                        j++;
                        while (lines[j] !== undefined && !lines[j].startsWith('<Iteration>')) {
                            query = query + lines[j] + '\n';
                            j++;
                        }
                        queries.push(query);
                    }
                }
                return queries;
            }

            function getTextQueries(content) {
                const queries = [];
                const lines = content.split('\n');
                let count = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('Query=')) {
                        count++;
                    }
                }
                if (count === 1) {
                    queries.push(content);
                } else {
                    let j = 0;
                    let init = '';
                    for (let i = 0; i < lines.length; i++) {
                        j = i;
                        if (lines[i].startsWith('Query=')) {
                            break;
                        } else {
                            init = init + lines[i] + '\n';
                        }
                    }
                    for (let x = 0; x < count; x++) {
                        let query = init + lines[j] + '\n';
                        j++;
                        while (lines[j] !== undefined && !lines[j].startsWith('Query=')) {
                            query = query + lines[j] + '\n';
                            j++;
                        }
                        query = query + '\nend\n';
                        queries.push(query);
                    }
                }
                return queries;
            }

            function getQueryLength(content) {
                const lines = content.split('\n');
                if (lines[2].startsWith("<BlastOutput>")) {
                    return getXMLQueryLength(content);
                } else {
                    return getTextQueryLength(content);
                }
            }

            function getXMLQueryLength(content) {
                const lines = content.split('\n');
                let length = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('<Iteration_query-len>')) {
                        length = lines[i].split('>')[1].split('</')[0];
                        break;
                    }
                }
                return length;
            }

            function getTextQueryLength(content) {
                const lines = content.split('\n');
                let length = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('Length=')) {
                        length = lines[i].split('=')[1];
                        break;
                    }
                }
                return length;
            }

            function getAlignments(content) {
                const lines = content.split('\n');
                if (lines[2].startsWith("<BlastOutput>")) {
                    return parseBlastXML(content);
                } else {
                    return parseBlastText(content);
                }

            }

            function parseBlastXML(content) {
                const lines = content.split('\n');
                const alignments = [];
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('<Hit>')) {
                        let hit = '';
                        for (let c = i; c < lines.length; c++) {
                            hit += lines[c];
                            if (lines[c].includes("</Hit>")) {
                                break;
                            }
                        }
                        const id = hit.split("<Hit_id>")[1].split("</")[0];
                        const def = hit.split("<Hit_def>")[1].split("</")[0];
                        const description = id.concat(' ').concat(def);
                        const length = hit.split("<Hit_len>")[1].split("</")[0];
                        const hsps_a = [];
                        const hsps_s = hit.split('<Hit_hsps>')[1].split('</Hit_hsps>')[0];
                        const hsps = hsps_s.split("</Hsp>");
                        for (const hsp of hsps.slice(0, -1)) {
                            const score = hsp.split("<Hsp_bit-score>")[1].split("</")[0];
                            const eValue = hsp.split("<Hsp_evalue>")[1].split("</")[0];
                            const idnt = hsp.split("<Hsp_identity>")[1].split("</")[0];
                            const a_length = hsp.split("<Hsp_align-len>")[1].split("</")[0];
                            const identities = [idnt, a_length];
                            let positives, gps, gaps
                            if (lines[3].includes('<BlastOutput_program>blastn</BlastOutput_program>')) {
                                positives = 'N/A';
                                gps = hsp.split("<Hsp_gaps>")[1].split("</")[0];
                                gaps = gps / a_length * 100;
                            } else {
                                pstves = hsp.split("<Hsp_positive>")[1].split("</")[0];
                                positives = parseFloat(pstves / a_length * 100).toFixed(0);
                                gps = hsp.split("<Hsp_gaps>")[1].split("</")[0];
                                gaps = gps / a_length * 100;
                            }
                            const queryStart = hsp.split("<Hsp_query-from>")[1].split("</")[0];
                            const query = hsp.split("<Hsp_qseq>")[1].split("</")[0];
                            const queryEnd = hsp.split("<Hsp_query-to>")[1].split("</")[0];
                            const comparison = hsp.split("<Hsp_midline>")[1].split("</")[0];
                            const sbjctStart = hsp.split("<Hsp_hit-from>")[1].split("</")[0];
                            const sbjct = hsp.split("<Hsp_hseq>")[1].split("</")[0];
                            const sbjctEnd = hsp.split("<Hsp_hit-to>")[1].split("</")[0];
                            hsps_a.push(new HSP(score, eValue, identities, positives, parseFloat(gaps).toFixed(0), queryStart, query, queryEnd, comparison, sbjctStart, sbjct, sbjctEnd));
                        }
                        let totalScore = parseFloat(hsps_a[0].score);
                        for (hsp of hsps_a) {
                            totalScore = totalScore + parseFloat(hsp.score);
                        }
                        const alignment = new BlastAlignment(description, length, totalScore.toFixed(1), getQueryCover(hsps_a, getQueryLength(content)), hsps_a);
                        alignments.push(alignment);
                    }
                }
                return alignments;
            }

            function parseBlastText(content) {
                const lines = content.split('\n');
                const alignments = [];
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('>')) {
                        let line1 = lines[i].split('>')[1];
                        let line2 = "";
                        let currentLine = i;
                        while (line2 === "") {
                            currentLine = currentLine + 1;
                            if (lines[currentLine].startsWith('Length=')) {
                                line2 = lines[currentLine];
                            } else {
                                line1 += lines[currentLine];
                            }
                        }
                        const description = line1;
                        const length = line2.split('=')[1];
                        const hsps = [];
                        let multiple = false;
                        do {
                            // skip header
                            if (multiple) {
                                currentLine = currentLine - 1;
                            }
                            if (lines[currentLine + 2].startsWith(' Features in this part of subject sequence:')) {
                                currentLine = currentLine + 3;
                                while (!lines[currentLine + 2].startsWith(" Score =")) {
                                    currentLine++;
                                }
                            }
                            const score = lines[currentLine + 2].split(',')[0].replace(/\s\s+/g, ' ').split(' ')[3];
                            const eValue = lines[currentLine + 2].split(',')[1].split(' ')[4];

                            // const oldIdentities = lines[currentLine + 3].split(',')[0].split('(')[1].substr(0, lines[currentLine + 3].split(',')[0].split('(')[1].length - 2);
                            let identities = lines[currentLine + 3].split(/[ \/]+/)
                            const idnt = parseInt(identities[3])
                            const a_length = parseInt(identities[4])
                            if (isNaN(idnt)) throw "Failed to parse idnt from BLAST (text format)";
                            if (isNaN(a_length)) throw "Failed to parse a_length from BLAST (text format)";
                            identities = [idnt, a_length];
                            let positives, gaps
                            if (lines[0].startsWith('BLASTN')) {
                                positives = 'N/A';
                                gaps = lines[currentLine + 3].split(',')[1].split('(')[1].substring(0, lines[currentLine + 3].split(',')[1].split('(')[1].length - 2);
                            } else {
                                positives = lines[currentLine + 3].split(',')[1].split('(')[1].substring(0, lines[currentLine + 3].split(',')[1].split('(')[1].length - 2);
                                gaps = lines[currentLine + 3].split(',')[2].split('(')[1].substring(0, lines[currentLine + 3].split(',')[2].split('(')[1].length - 2);
                            }
                            if (lines[currentLine + 4].split(',')[0].split(' ')[1] === 'Frame' || lines[currentLine + 4].startsWith(' Strand')) {
                                currentLine = currentLine + 1;
                            }

                            function extractLineProps(lineIndex) {
                                const queryLine = lines[lineIndex]
                                const comprLine = lines[lineIndex + 1]
                                const sbjctLine = lines[lineIndex + 2]

                                // sanity check
                                if (!queryLine.startsWith('Query ')) throw `Error: lineQuery does not start with 'Query ': ${queryLine}`
                                if (!comprLine.startsWith('      ')) throw `Error: lineCompr does not start with '      ': ${comprLine}`
                                if (!sbjctLine.startsWith('Sbjct ')) throw `Error: lineSbjct does not start with 'Sbjct ': ${sbjctLine}`

                                // extract query params
                                const queryArr = queryLine.replace(/\s+/g, ' ').split(' ')  // [ "Query", "61", "CCCGCA", "120" ]
                                const queryStart = parseInt(queryArr[1])
                                const querySeq = queryArr[2]
                                const queryEnd = parseInt(queryArr[3])

                                // extract startIndex and endIndex
                                const startIndex = queryLine.indexOf(querySeq)
                                const endIndex = startIndex + querySeq.length

                                return {
                                    query: {start: queryStart, seq: querySeq, end: queryEnd},
                                    compr: {seq: comprLine.substring(startIndex, endIndex)},
                                    sbjct: {
                                        start: parseInt(sbjctLine.substring(5, startIndex)),
                                        seq: sbjctLine.substring(startIndex, endIndex),
                                        end: parseInt(sbjctLine.substring(endIndex))
                                    }
                                }
                            }

                            const hsaData = extractLineProps(currentLine + 5)

                            currentLine = currentLine + 9;
                            while (lines[currentLine].startsWith('Query')) {
                                const currentData = extractLineProps(currentLine)
                                // append sequence
                                hsaData.query.seq += currentData.query.seq
                                hsaData.compr.seq += currentData.compr.seq
                                hsaData.sbjct.seq += currentData.sbjct.seq

                                // update end coordinates
                                hsaData.query.end = currentData.query.end
                                hsaData.sbjct.end = currentData.sbjct.end

                                // move to next data
                                currentLine = currentLine + 4;
                            }
                            const hsp = new HSP(score, eValue, identities, positives, gaps, hsaData.query.start, hsaData.query.seq, hsaData.query.end, hsaData.compr.seq, hsaData.sbjct.start, hsaData.sbjct.seq, hsaData.sbjct.end)
                            hsps.push(hsp);
                            multiple = true;
                        } while (lines[currentLine + 1].startsWith(' Score'));
                        let totalScore = parseFloat(hsps[0].score);
                        for (let x = 1; x < hsps.length; x++) {
                            totalScore = totalScore + parseFloat(hsps[x].score);
                        }
                        const alignment = new BlastAlignment(description, length, totalScore.toFixed(1), getQueryCover(hsps, getQueryLength(content)), hsps);
                        alignments.push(alignment);
                    }
                }
                return alignments;
            }

            function getQueryCover(hsps, length) {
                let cover = 0;
                const noOver = getHSPWithoutOverlapping(hsps);
                for (let i = 0; i < noOver.length; i++) {
                    cover = cover + parseInt(100 * (noOver[i].end - noOver[i].start + 1) / length);
                }
                return cover;
            }

            function getHSPWithoutOverlapping(hsps) {
                const hspNoOver = [];
                for (let i = 0; i < hsps.length; i++) {
                    if (parseInt(hsps[i].queryStart) > parseInt(hsps[i].queryEnd)) {
                        hspNoOver.push({start: parseInt(hsps[i].queryEnd), end: parseInt(hsps[i].queryStart)});
                    } else {
                        hspNoOver.push({start: parseInt(hsps[i].queryStart), end: parseInt(hsps[i].queryEnd)});
                    }
                }
                return getNoOverlappingArray(partitionIntoOverlappingRanges(hspNoOver));
            }

            function partitionIntoOverlappingRanges(array) {
                array.sort(function (a, b) {
                    if (a.start < b.start) return -1;
                    if (a.start > b.start) return 1;
                    return 0;
                });
                const getMaxEnd = function (array) {
                    if (array.length === 0) return false;
                    array.sort(function (a, b) {
                        if (a.end < b.end) return 1;
                        if (a.end > b.end) return -1;
                        return 0;
                    });
                    return array[0].end;
                };
                const rarray = [];
                let g = 0;
                rarray[g] = [array[0]];

                for (let i = 1, l = array.length; i < l; i++) {
                    if ((array[i].start >= array[i - 1].start) && (array[i].start < getMaxEnd(rarray[g]))) {
                        rarray[g].push(array[i]);
                    } else {
                        g++;
                        rarray[g] = [array[i]];
                    }
                }
                return rarray;
            }

            function getNoOverlappingArray(array) {
                const result = [];
                for (let i = 0; i < array.length; i++) {
                    let start = array[i][0].start;
                    let end = array[i][0].end;
                    for (let j = 0; j < array[i].length; j++) {
                        if (array[i][j].start < start) start = array[i][j].start;
                        if (array[i][j].end > end) end = array[i][j].end;
                    }
                    result.push({start: start, end: end});
                }
                return result;
            }

            function getColor(colored, scoring, score, evalue) {
                let colorNb;
                if (!scoring) {
                    if (evalue > 100) {
                        colorNb = 1;
                    } else if (evalue <= 100 && evalue > 1) {
                        colorNb = 2;
                    } else if (evalue <= 1 && evalue > 0.01) {
                        colorNb = 3;
                    } else if (evalue <= 0.01 && evalue > 0.00001) {
                        colorNb = 4
                    } else {
                        colorNb = 5;
                    }
                } else {
                    if (score < 40) {
                        colorNb = 1;
                    } else if (score >= 40 && score < 50) {
                        colorNb = 2;
                    } else if (score >= 50 && score < 80) {
                        colorNb = 3;
                    } else if (score >= 80 && score < 200) {
                        colorNb = 4
                    } else {
                        colorNb = 5;
                    }
                }
                return getDivColor(colored, colorNb);
            }

            function getDivColorText(scoring, div) {
                if (!scoring) {
                    switch (div) {
                        case 1:
                            return '>100';
                        case 2:
                            return '100-1';
                        case 3:
                            return '1-1e<sup>-2</sup>';
                        case 4:
                            return '1e<sup>-2</sup>-1e<sup>-5</sup>';
                        case 5:
                            return '<1e<sup>-5</sup>';
                        default:
                            return '0';
                    }
                } else {
                    switch (div) {
                        case 1:
                            return '<40';
                        case 2:
                            return '40-50';
                        case 3:
                            return '50-80';
                        case 4:
                            return '80-200';
                        case 5:
                            return '>=200';
                        default:
                            return '0';
                    }

                }
            }

            function getDivColor(colored, div) {
                if (colored) {
                    switch (div) {
                        case 1:
                            return '#5C6D7E';
                        case 2:
                            return '#9B59B6';
                        case 3:
                            return '#5CACE2';
                        case 4:
                            return '#57D68D';
                        case 5:
                            return '#C0392B';
                        default:
                            return '#FFF';
                    }
                } else {
                    switch (div) {
                        case 1:
                            return '#BCBCBC';
                        case 2:
                            return '#989898';
                        case 3:
                            return '#747474';
                        case 4:
                            return '#565656';
                        case 5:
                            return '#343434';
                        default:
                            return '#FFF';
                    }
                }
            }

            function selectAlignment(alignment) {
                const item = document.getElementById(alignment).parentElement.parentElement;
                const items = document.getElementsByClassName('alignment-table-description');
                let i;
                for (i = 0; i < items.length; i++) {
                    items[i].style.fontWeight = 'normal';
                    items[i].parentElement.parentElement.style.fontWeight = 'normal';
                }
                item.style.fontWeight = 'bold';
                document.getElementById(alignment).style.fontWeight = 'bold';
            }

            function createColorsDiv(colored, scoring) {
                const container = document.createElement('div');
                const divSpace = document.createElement('div');
                const divClear = document.createElement('div');
                container.style.color = '#EEE';
                divSpace.style.minWidth = '50px';
                divSpace.style.minHeight = '10px';
                divSpace.style.float = 'left';
                container.appendChild(divSpace);
                for (let i = 1; i <= 5; i++) {
                    const div = document.createElement('div');
                    div.style.minWidth = '100px';
                    div.style.textAlign = 'center';
                    div.style.float = 'left';
                    div.innerHTML = getDivColorText(scoring, i);
                    div.style.fontWeight = 'bold';
                    div.style.backgroundColor = getDivColor(colored, i);
                    container.appendChild(div);
                }
                divClear.style.clear = 'both';
                container.appendChild(divClear);
                return container;
            }

            function createQueryDiv(colored) {
                const container = document.createElement('div');
                const divSpace = document.createElement('div');
                const divQuery = document.createElement('div');
                const divClear = document.createElement('div');
                container.style.marginTop = '3px';
                container.style.color = '#5C6D7E';
                container.style.fontSize = '10px';
                divSpace.style.width = '50px';
                divSpace.innerHTML = 'QUERY';
                divSpace.style.fontWeight = 'bold';
                divSpace.style.float = 'left';
                divQuery.style.width = '500px';
                divQuery.style.height = '10px';
                divQuery.style.float = 'left';
                divQuery.style.marginTop = '2px';
                divClear.style.clear = 'both';
                if (colored) {
                    divQuery.style.backgroundColor = '#C0392B';
                } else {
                    divQuery.style.backgroundColor = '#343434';
                }
                container.appendChild(divSpace);
                container.appendChild(divQuery);
                container.appendChild(divClear);
                return container;
            }

            function createNumbersDiv(lenght) {
                const container = document.createElement('div');
                const divSpace = document.createElement('div');
                let divNumbers = document.createElement('div');
                const divClear = document.createElement('div');
                container.style.marginBottom = '5px';
                container.style.fontSize = '11px';
                divSpace.style.minWidth = '50px';
                divSpace.style.minHeight = '10px';
                divSpace.style.float = 'left';
                divNumbers.style.float = 'left';
                divClear.style.clear = 'both';
                divNumbers = divideDivNumbers(divNumbers, lenght);
                container.appendChild(divSpace);
                container.appendChild(divNumbers);
                container.appendChild(divClear);
                return container;
            }

            function divideDivNumbers(container, lenght) {
                const divClear = document.createElement('div');
                if (lenght > 4) {
                    if (lenght % 5 === 0) {
                        container = createDivisionsDivNumbers(container, 5, lenght / 5, 100);
                    } else {
                        const pixels = 500 / (5 + ((lenght % 5) / 5));
                        container = createDivisionsDivNumbers(container, 5, parseInt(lenght / 5), parseInt(pixels));
                        //We can do this or not
                        const pxrest = parseInt(500 - (pixels * 5));
                        const div = document.createElement('div');
                        div.style.float = 'left';
                        div.style.width = pxrest + 'px';
                        div.style.textAlign = 'right';
                        div.innerHTML = lenght;
                        container.appendChild(div);
                    }
                } else {
                    container = createDivisionsDivNumbers(container, lenght, 1, parseInt(500 / lenght));
                }
                divClear.style.clear = 'both';
                container.appendChild(divClear);
                return container;
            }

            function createDivisionsDivNumbers(container, divisions, size, pixels) {
                for (let i = 0; i < divisions; i++) {
                    if (i === 0) {
                        const px2 = pixels / 2;
                        const div1 = document.createElement('div');
                        const div2 = document.createElement('div');
                        div1.style.float = 'left';
                        div1.style.width = px2 + 'px';
                        div1.style.textAlign = 'left';
                        div1.innerHTML = '0';
                        div2.style.float = 'left';
                        div2.style.width = px2 + 'px';
                        div2.style.textAlign = 'right';
                        div2.innerHTML = size * (i + 1);
                        container.appendChild(div1);
                        container.appendChild(div2);
                    } else {
                        const div = document.createElement('div');
                        div.style.float = 'left';
                        div.style.width = pixels + 'px';
                        div.style.textAlign = 'right';
                        div.innerHTML = size * (i + 1);
                        container.appendChild(div);
                    }
                }
                return container;
            }


            function createHeader(container, colored, scoring, lenght) {
                const text = document.createElement('div');
                const colors = createColorsDiv(colored, scoring);
                const query = createQueryDiv(colored);
                const numbers = createNumbersDiv(lenght);
                text.style.color = '#5C6D7E';
                text.style.textAlign = 'center';
                text.style.paddingBottom = '5px';
                text.innerHTML = 'COLOR KEY FOR ALIGNMENT SCORES';
                text.style.fontWeight = 'bold';
                container.appendChild(text);
                container.appendChild(colors);
                container.appendChild(query);
                container.appendChild(numbers);
                return container;
            }

            function createBody(alignments, queryLength, container, colored, scoring) {
                const alignmentContainer = document.createElement('div');
                alignmentContainer.style.paddingBottom = '10px';
                for (let i = 0; i < alignments.length; i++) {
                    const alignment = createAlignmentDiv(getColor(colored, scoring, alignments[i].hsp[0].score, alignments[i].hsp[0].eValue), alignments[i], queryLength);
                    alignment.style.marginBottom = '4px';
                    alignmentContainer.appendChild(alignment);
                }
                container.appendChild(alignmentContainer);
                return container;
            }

            function createAlignmentDiv(color, alignment, queryLength) {
                const noOver = getHSPWithoutOverlapping(alignment.hsp);

                const container = document.createElement('div');
                const divClear = document.createElement('div');
                container.style.minHeight = '12px';

                for (let i = 0; i < noOver.length; i++) {
                    const white = document.createElement('div');
                    const colored = document.createElement('div');
                    const link = document.createElement('a');
                    let init, offset;
                    if (i === 0) {
                        if (noOver[0].start === 1) init = parseInt(50 + ((500 * (noOver[0].start - 1)) / queryLength)); else init = parseInt(50 + ((500 * (noOver[0].start)) / queryLength));
                        offset = parseInt(550 - init - (500 * (queryLength - noOver[0].end) / queryLength));
                    } else {
                        init = parseInt((500 * (noOver[i].start - noOver[i - 1].end) / queryLength));
                        offset = parseInt((500 * (noOver[i].end - noOver[i].start) / queryLength));
                    }
                    white.style.width = init + 'px';
                    white.style.minHeight = '4px';
                    white.style.float = 'left';
                    colored.style.width = offset + 'px';
                    colored.style.minHeight = '12px';
                    colored.style.float = 'left';
                    colored.style.backgroundColor = color;
                    colored.onmouseout = function () {
                        document.getElementById('defline').value = ' Mouse over to show defline and scores, click to show alignments';
                    };
                    colored.onmouseover = function () {
                        document.getElementById('defline').value = ' ' + alignment.description + '. S=' + alignment.hsp[0].score + ' E=' + alignment.hsp[0].eValue;
                    };


                    link.href = '#' + alignment.description.split(' ')[0];
                    link.onclick = function () {
                        selectAlignment(alignment.description.split(' ')[0]);
                    };
                    link.appendChild(colored);
                    container.appendChild(white);
                    container.appendChild(link);
                }
                divClear.style.clear = 'both';
                container.appendChild(divClear);
                return container;
            }

            function createChangeScoringButton(queries, hsps, position, alignments, lenght, colored, scoring, self) {
                const button = document.createElement('button');
                button.id = 'changeScore';
                button.className = 'btn';
                button.style.margin = '5px';
                const text = document.createTextNode(scoring ? 'Score by to E value' : 'Score by Max score')
                button.appendChild(text);
                button.onclick = function () {
                    changeScoring(queries, hsps, position, alignments, lenght, button, colored, scoring, self);
                };
                return button;

            }

            function createChangeColorButton(queries, hsps, position, alignments, lenght, colored, scoring, self) {
                const button = document.createElement('button');
                button.id = 'changeColors';
                button.className = 'btn';
                button.style.margin = '5px';
                const text = document.createTextNode(colored ? 'Color grayscale' : 'Color multicolor')
                button.appendChild(text);
                button.onclick = function () {
                    changeColors(queries, hsps, position, alignments, lenght, button, colored, scoring, self);
                };
                return button;
            }

            function createDownloadButton() {
                const button = document.createElement('button');
                button.className = 'btn';
                button.style.margin = '5px';
                const text = document.createTextNode('Download as PNG');
                button.appendChild(text);
                button.addEventListener("click", function () {
                    downloadAsImage(
                        document.querySelector('#alignments-container-pic'),
                        'alignments.png'
                    )

                }, false);
                return button;
            }

            function changeColors(queries, hsps, position, alignments, lenght, button, colored, scoring, self) {
                colored = !colored
                button.removeChild(button.childNodes[0]);
                const blastDiv = document.getElementById(self.opt.multipleAlignments);
                while (blastDiv.firstChild) {
                    blastDiv.removeChild(blastDiv.firstChild);
                }
                createAlignmentComparison(queries, hsps, position, alignments, lenght, colored, scoring, self);
            }

            function changeScoring(queries, hsps, position, alignments, lenght, button, colored, scoring, self) {
                scoring = !scoring
                button.removeChild(button.childNodes[0]);
                const blastDiv = document.getElementById(self.opt.multipleAlignments);
                while (blastDiv.firstChild) {
                    blastDiv.removeChild(blastDiv.firstChild);
                }
                createAlignmentComparison(queries, hsps, position, alignments, lenght, colored, scoring, self);
            }

            function getQueryText(content) {
                const lines = content.split('\n');
                if (lines[2].startsWith("<BlastOutput>")) {
                    return getXMLQueryText(content);
                } else {
                    return getTextQueryText(content);
                }
            }


            function getXMLQueryText(content) {
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('<Iteration_query-def>')) {
                        return lines[i].split('>')[1].split('</')[0];
                    }
                }
            }

            function getTextQueryText(content) {
                const lines = content.split('\n');
                let text = '';
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('Query=')) {
                        text = lines[i].split('=')[1];
                        i++;
                        while (!lines[i].startsWith('Length=')) {
                            text = text + ' ' + lines[i];
                            i++;
                        }
                        break;
                    }
                }
                return text;
            }

            function goToQuery(queries, hsps, position, queryLength, colored, scoring, self) {
                const alignments = getAlignments(queries[position]);
                const queryLength_ = getQueryLength(queries[position]);
                if (alignments.length === 0) {
                    const divs = ["blast-alignments-table", "blast-single-alignment"];
                    for (const div of divs) {
                        while (div.firstChild) {
                            div.removeChild(div.firstChild);
                        }
                    }
                    createEmptyAlignmentComparison(queries, [], position, queryLength_, true, true, self);
                } else {
                    createAlignmentComparison(queries, hsps, position, alignments, queryLength_, colored, scoring, self);
                    createAlignmentTable(alignments, self);
                    const nHsps = alignments[0].hsp.length;
                    createSingleAlignment(alignments[0], self, nHsps, 0);
                }
            }

            function createSelectQueries(queries, hsps, position, queryLength, colored, scoring, self) {
                position = parseInt(position)
                const selectQuery = document.createElement('select');
                selectQuery.style.width = '430px';
                selectQuery.style.marginBottom = '20px';
                selectQuery.style.color = '#5C6D7E';
                selectQuery.style.float = 'right';
                for (let i = 0; i < queries.length; i++) {
                    const query = document.createElement('option');
                    query.value = i;
                    query.text = getQueryText(queries[i]);
                    if (i === position) {
                        query.selected = 'selected';
                    }
                    selectQuery.appendChild(query);
                }
                selectQuery.onchange = function () {
                    goToQuery(queries, hsps, selectQuery.value, queryLength, colored, scoring, self);
                };
                return selectQuery;
            }


            function createEmptyAlignmentComparison(queries, hsps, position, queryLength, colored, scoring, self) {
                const blastDiv = document.getElementById(self.opt.multipleAlignments);
                while (blastDiv.hasChildNodes()) {
                    blastDiv.removeChild(blastDiv.firstChild);
                }
                let container = document.createElement('div');
                const containerButtons = document.createElement('div');
                const empty = document.createElement('div');
                blastDiv.style.paddingTop = '20px';
                container.id = 'alignments-container';
                container.style.border = 'thin solid #DDD';
                container.style.margin = '0 auto';
                container.style.padding = '10px';
                container.style.maxWidth = '580px';
                container.style.backgroundColor = '#FFF';
                empty.innerHTML = "***NO HITS FOUND***";
                empty.style.fontWeight = 'bold';
                empty.style.paddingTop = '30px';
                empty.style.paddingBottom = '50px';
                empty.style.textAlign = 'center';

                if (queries.length > 1) {
                    const selectQuery = createSelectQueries(queries, hsps, position, queryLength, colored, scoring, self);
                    const resultsFor = document.createElement('div');
                    const clearDiv = document.createElement('div');
                    clearDiv.style.clear = 'both';
                    resultsFor.innerHTML = 'RESULTS FOR:';
                    resultsFor.style.fontWeight = 'bold';
                    resultsFor.style.marginBottom = '5px';
                    resultsFor.style.color = '#5C6D7E';
                    resultsFor.style.float = 'left';
                    container.appendChild(resultsFor);
                    container.appendChild(selectQuery);
                    container.appendChild(clearDiv);
                }
                container = createHeader(container, colored, scoring, queryLength);
                container.appendChild(empty);
                blastDiv.style.minWidth = '580px';
                container.appendChild(containerButtons);
                blastDiv.appendChild(container);
            }

            function createAlignmentComparison(queries, hsps, position, alignments, queryLength, colored, scoring, self) {
                const blastDiv = document.getElementById(self.opt.multipleAlignments);
                while (blastDiv.hasChildNodes()) {
                    blastDiv.removeChild(blastDiv.firstChild);
                }
                let container = document.createElement('div');
                let picContainer = document.createElement('div');
                const containerButtons = document.createElement('div');
                const input = document.createElement('input');
                const buttonColors = createChangeColorButton(queries, hsps, position, alignments, queryLength, colored, scoring, self);
                const buttonScoring = createChangeScoringButton(queries, hsps, position, alignments, queryLength, colored, scoring, self);
                const buttonDownloadPNG = createDownloadButton('PNG');
                blastDiv.style.paddingTop = '20px';
                blastDiv.style.minWidth = '580px';
                input.id = 'defline';
                input.name = 'defline';
                input.type = 'text';
                input.value = ' Mouse over to show defline and scores, click to show alignments';
                input.style.width = '556px';
                input.style.padding = '1px';
                input.style.border = 0;
                input.style.cursos = 'auto';
                input.style.textAlign = 'center';
                picContainer.id = 'alignments-container-pic';
                container.id = 'alignments-container';
                container.style.border = 'thin solid #DDD';
                container.style.margin = '0 auto';
                container.style.padding = '10px';
                container.style.maxWidth = '580px';
                container.style.backgroundColor = '#FFF';

                if (queries.length > 1) {
                    const selectQuery = createSelectQueries(queries, hsps, position, queryLength, colored, scoring, self);
                    const resultsFor = document.createElement('div');
                    const clearDiv = document.createElement('div');
                    clearDiv.style.clear = 'both';
                    resultsFor.innerHTML = 'RESULTS FOR:';
                    resultsFor.style.fontWeight = 'bold';
                    resultsFor.style.marginBottom = '5px';
                    resultsFor.style.color = '#5C6D7E';
                    resultsFor.style.float = 'left';
                    picContainer.appendChild(resultsFor);
                    picContainer.appendChild(selectQuery);
                    picContainer.appendChild(clearDiv);
                }
                picContainer = createHeader(picContainer, colored, scoring, queryLength);
                picContainer = createBody(alignments, queryLength, picContainer, colored, scoring);
                containerButtons.style.textAlign = 'center';
                containerButtons.id = 'blast-multiple-alignments-buttons';
                containerButtons.appendChild(input);
                containerButtons.appendChild(buttonScoring);
                containerButtons.appendChild(buttonColors);
                containerButtons.appendChild(buttonDownloadPNG);
                container.appendChild(picContainer);
                container.appendChild(containerButtons);
                blastDiv.appendChild(container);
            }

            function createTableHeader() {
                const table = document.createElement('table')
                const thead = document.createElement('thead')
                const theadTr = document.createElement('tr')
                table.className = "table table-striped"
                for (const column of ['Description', 'Max score', 'Total score', 'Query cover', 'E value', 'Identities (rel)', 'Identities']) {
                    el = document.createElement('th')
                    el.innerHTML = column
                    el.style.fontWeight = 'bold'
                    theadTr.appendChild(el)
                }
                thead.appendChild(theadTr);
                table.appendChild(thead);
                return table;
            }

            function createTableButtons(alignments) {
                const container = document.createElement('div');
                const butTSV = document.createElement('button');
                container.style.textAlign = 'right';
                butTSV.style.marginRight = '10px';
                butTSV.className = 'btn';
                butTSV.innerHTML = 'Download as TSV';
                butTSV.onclick = function () {
                    downloadTableTSV(alignments);
                };
                container.appendChild(butTSV);
                return container;
            }

            function createAlignmentTable(alignments, self) {
                const tableDiv = document.getElementById(self.opt.alignmentsTable);
                while (tableDiv.hasChildNodes()) {
                    tableDiv.removeChild(tableDiv.firstChild);
                }
                const imgContainer = document.createElement('div');
                const butContainer = createTableButtons(alignments);
                const table = createTableHeader();
                const tbody = document.createElement('tbody');
                tableDiv.style.paddingTop = '50px';
                imgContainer.style.backgroundColor = '#FFF';
                imgContainer.id = 'blast-alignments-table-img';
                for (const alignment of alignments) {
                    const tr = document.createElement('tr');
                    const tdDesc = document.createElement('td');
                    const butDesc = document.createElement('button');
                    butDesc.alignment = alignment;
                    butDesc.onclick = function () {
                        if (self.opt.callback) {
                            self.opt.callback(this.alignment);
                        } else {
                            location.href = '#' + self.opt.singleAlignment;
                            createSingleAlignment(this.alignment, self, this.alignment.hsp.length, 0);
                        }
                    };
                    butDesc.id = alignment.description.split(" ")[0];
                    butDesc.innerHTML = alignment.description;
                    butDesc.style.border = 0;
                    butDesc.style.padding = 0;
                    butDesc.style.display = 'inline';
                    butDesc.style.background = 'none';
                    butDesc.className = 'alignment-table-description';
                    tdDesc.appendChild(butDesc);
                    const hsp = alignment.hsp[0]
                    const tdMaxScore = document.createElement('td');
                    tdMaxScore.innerHTML = hsp.score;
                    const tdTotalScore = document.createElement('td');
                    tdTotalScore.innerHTML = alignment.totalScore;
                    const tdQueryCover = document.createElement('td');
                    tdQueryCover.innerHTML = alignment.queryCover + "%";
                    const tdEvalue = document.createElement('td');
                    tdEvalue.innerHTML = hsp.eValue;
                    const tdIdentitiesRel = document.createElement('td');
                    tdIdentitiesRel.innerHTML = hsp.identitiesRel;
                    const tdIdentitiesFrac = document.createElement('td');
                    tdIdentitiesFrac.innerHTML = hsp.identitiesFraction;
                    tr.appendChild(tdDesc);
                    tr.appendChild(tdMaxScore);
                    tr.appendChild(tdTotalScore);
                    tr.appendChild(tdQueryCover);
                    tr.appendChild(tdEvalue);
                    tr.appendChild(tdIdentitiesRel);
                    tr.appendChild(tdIdentitiesFrac);
                    tbody.appendChild(tr);
                }
                table.appendChild(tbody);
                imgContainer.appendChild(table);
                tableDiv.appendChild(imgContainer);
                tableDiv.appendChild(butContainer);
            }

            function downloadTableTSV(alignments) {
                let tsvContent = 'data:text/tsv;charset=utf-8,';
                tsvContent += 'Description\tScore\teValue\tIdentities [%]\tIdentities [fraction]\tPositives\tGaps\n';

                for (const alignment of alignments) {
                    const hsp = alignment.hsp[0]
                    tsvContent += `${alignment.description}\t${hsp.score}\t${hsp.eValue}\t${hsp.identitiesRel}\t${hsp.identitiesFraction}\t${hsp.positives}\t${hsp.gaps}\n`
                }
                const encodedUri = encodeURI(tsvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'alignments-table.tsv');
                link.click();
            }

            function createSingleAlignment(alignment, self, hsps, hsp) {
                const alignmentDiv = document.getElementById(self.opt.singleAlignment);
                while (alignmentDiv.hasChildNodes()) {
                    alignmentDiv.removeChild(alignmentDiv.firstChild);
                }

                const alignmentPre = document.createElement('pre');
                const alignmentTitleDiv = document.createElement('div');
                const alignmentButtonDiv = document.createElement('div');
                const alignmentScrollContainer = document.createElement('div');
                const alignmentContainer = document.createElement('div');
                const buttonDownloadPNG = document.createElement('button');
                const span = document.createElement('span');
                const divStatsParent = document.createElement('div');
                const divScore = document.createElement('div');
                const divEvalue = document.createElement('div');
                const divIdentity = document.createElement('div');
                const divPositives = document.createElement('div');
                const divGaps = document.createElement('div');
                const divClear = document.createElement('div');
                const queryDiv = createSingleQueryDiv(alignment.hsp[hsp].query, alignment.hsp[hsp].queryStart, alignment.hsp[hsp].queryEnd);
                const comparisonDiv = createSingleComparisonDiv(alignment.hsp[hsp].comparison);
                const subjectDiv = createSingleSubjectDiv(alignment.hsp[hsp].subject, alignment.hsp[hsp].subjectStart, alignment.hsp[hsp].subjectEnd);

                alignmentPre.id = 'blast-single-alignment-pre';
                alignmentPre.style.color = '#2c3e50';
                alignmentPre.style.textAlign = 'left';
                alignmentPre.style.fontFamily = 'Helvetica,Arial,sans-serif';
                alignmentPre.style.margin = '0';
                alignmentPre.style.padding = '0';
                alignmentTitleDiv.style.display = 'flex'
                alignmentTitleDiv.style.justifyContent = 'space-between'
                alignmentTitleDiv.style.alignItems = 'center'
                alignmentTitleDiv.style.minHeight = '32px'
                alignmentScrollContainer.id = 'blasterjs-alignment-scroll-container'
                alignmentScrollContainer.style.overflow = 'scroll'
                alignmentContainer.id = 'blasterjs-alignment-container'
                alignmentContainer.style.margin = '0 auto';
                alignmentContainer.style.display = 'table';
                alignmentContainer.style.paddingTop = '30px';
                alignmentContainer.style.paddingBottom = '30px';
                alignmentDiv.style.textAlign = 'right';
                alignmentDiv.style.paddingTop = '50px';
                buttonDownloadPNG.className = 'btn';
                buttonDownloadPNG.innerHTML = 'Download as PNG';
                buttonDownloadPNG.style.marginRight = '10px';
                buttonDownloadPNG.onclick = function () {
                    downloadAsImage(
                        document.querySelector('#blasterjs-alignment-container'),
                        `${alignment.description}-alignment.png`
                    )
                }

                span.innerHTML = alignment.description;
                span.style.paddingLeft = '15px';
                span.style.fontWeight = 'bold';
                span.style.fontSize = '15px';
                span.style.fontFamily = 'Helvetica,Arial,sans-serif';

                divStatsParent.id = 'blasterjs-stats-div'
                divStatsParent.style.paddingTop = '20px';
                divStatsParent.style.fontSize = '14px';
                divStatsParent.style.textAlign = 'center';
                divStatsParent.style.fontFamily = 'Helvetica,Arial,sans-serif';
                divStatsParent.style.display = 'table';
                divStatsParent.style.margin = '0px auto';
                divStatsParent.style.width = '100%';
                divScore.innerHTML = '<b>Score:</b></br>' + alignment.hsp[hsp].score;
                divScore.style.float = 'left';
                divScore.style.width = "20%";
                divEvalue.innerHTML = '<b>Expect:</b></br>' + alignment.hsp[hsp].eValue;
                divEvalue.style.float = 'left';
                divEvalue.style.width = "20%";
                divIdentity.innerHTML = `<b>Identities:</b></br>${alignment.hsp[hsp].identitiesRel} (${alignment.hsp[hsp].identitiesFraction})`;
                divIdentity.style.float = 'left';
                divIdentity.style.width = "20%";
                divPositives.innerHTML = '<b>Positives:</b></br>' + alignment.hsp[hsp].positives + '%';
                divPositives.style.float = 'left';
                divPositives.style.width = "20%";
                divGaps.innerHTML = '<b>Gaps:</b></br>' + alignment.hsp[hsp].gaps + '%';
                divGaps.style.float = 'left';
                divGaps.style.width = "20%";
                divClear.style.clear = 'both';

                divStatsParent.appendChild(divScore);
                divStatsParent.appendChild(divEvalue);
                divStatsParent.appendChild(divIdentity);
                divStatsParent.appendChild(divPositives);
                divStatsParent.appendChild(divGaps);
                divStatsParent.appendChild(divClear);

                alignmentContainer.appendChild(queryDiv);
                alignmentContainer.appendChild(comparisonDiv);
                alignmentContainer.appendChild(subjectDiv);
                alignmentScrollContainer.appendChild(alignmentContainer)
                alignmentButtonDiv.appendChild(span);
                if (hsps > 1) {
                    const buttonNext = document.createElement('button');
                    buttonNext.className = 'btn btn-primary';
                    buttonNext.style.padding = '3px';
                    buttonNext.style.marginLeft = '15px';
                    buttonNext.id = 'blast-single-alignment-next';
                    buttonNext.innerHTML = 'Next HSP';
                    const goTo = hsp === hsps - 1 ? 0 : hsp + 1;
                    buttonNext.onclick = function () {
                        createSingleAlignment(alignment, self, hsps, goTo);
                    };
                    alignmentButtonDiv.appendChild(buttonNext);
                }
                alignmentTitleDiv.appendChild(alignmentButtonDiv);
                alignmentTitleDiv.appendChild(buttonDownloadPNG);
                alignmentPre.appendChild(alignmentTitleDiv);
                alignmentPre.appendChild(divStatsParent);
                alignmentPre.appendChild(alignmentScrollContainer);
                alignmentDiv.appendChild(alignmentPre);
            }

            function downloadAsImage(element, fileName) {
                html2canvas(element)
                    .then(canvas => {
                        canvas.style.display = 'none'
                        document.body.appendChild(canvas)
                        return canvas
                    })
                    .then(canvas => {
                        const image = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream')
                        const a = document.createElement('a')
                        a.setAttribute('download', fileName)
                        a.setAttribute('href', image)
                        a.click()
                        canvas.remove()
                    })
                    .catch((err) => {
                        alert('Failed to render image. Consider zooming out.')
                        console.error(err)
                    })
            }

            function createSingleQueryDiv(query, start, end) {
                const textDiv = document.createElement('div');
                const startDiv = document.createElement('div');
                const endDiv = document.createElement('div');
                const queryDiv = document.createElement('div');
                textDiv.innerHTML = 'Query';
                textDiv.style.fontWeight = 'bold';
                textDiv.style.display = 'inline-block';
                textDiv.style.marginRight = '20px';
                textDiv.style.textAlign = 'right';
                textDiv.style.width = '55px';
                startDiv.innerHTML = String(start);
                startDiv.style.fontWeight = 'bold';
                startDiv.style.display = 'inline-block';
                startDiv.style.marginRight = '20px';
                startDiv.style.width = '25px';
                endDiv.innerHTML = String(end);
                endDiv.style.fontWeight = 'bold';
                endDiv.style.display = 'inline-block';
                endDiv.style.marginLeft = '20px';
                endDiv.style.marginRight = '70px';
                queryDiv.appendChild(textDiv);
                queryDiv.appendChild(startDiv);
                for (let i = 0; i < query.length; i++) {
                    const div = document.createElement('div');
                    const letter = query.charAt(i);
                    div.classList.add('blasterjs-alignment', `blasterjs-${letter !== ' ' ? letter : '_'}`);
                    div.innerHTML = letter;
                    queryDiv.appendChild(div);
                }
                queryDiv.appendChild(endDiv);
                return queryDiv;
            }

            function createSingleComparisonDiv(comparison) {
                const comparisonDiv = document.createElement('div');
                const spaceDiv = document.createElement('div');
                spaceDiv.style.minWidth = '120px';
                spaceDiv.style.minHeight = '1px';
                spaceDiv.style.display = 'inline-block';
                comparisonDiv.appendChild(spaceDiv);
                for (let i = 0; i < comparison.length; i++) {
                    const div = document.createElement('div');
                    const letter = comparison.charAt(i);
                    div.classList.add('blasterjs-alignment', `blasterjs-${letter !== ' ' ? letter : '_'}`);
                    div.innerHTML = letter;
                    comparisonDiv.appendChild(div);
                }
                return comparisonDiv;
            }

            function createSingleSubjectDiv(subject, start, end) {
                const textDiv = document.createElement('div');
                const startDiv = document.createElement('div');
                const endDiv = document.createElement('div');
                const subjectDiv = document.createElement('div');
                textDiv.innerHTML = 'Subject';
                textDiv.style.fontWeight = 'bold';
                textDiv.style.display = 'inline-block';
                textDiv.style.textAlign = 'right';
                textDiv.style.marginRight = '20px';
                textDiv.style.width = '55px';
                startDiv.style.width = '25px';
                startDiv.innerHTML = String(start);
                startDiv.style.fontWeight = 'bold';
                startDiv.style.display = 'inline-block';
                startDiv.style.marginRight = '20px';
                endDiv.innerHTML = String(end);
                endDiv.style.fontWeight = 'bold';
                endDiv.style.display = 'inline-block';
                endDiv.style.marginLeft = '20px';
                endDiv.style.marginRight = '70px';
                subjectDiv.appendChild(textDiv);
                subjectDiv.appendChild(startDiv);
                for (let i = 0; i < subject.length; i++) {
                    const div = document.createElement('div');
                    const letter = subject.charAt(i);
                    div.classList.add('blasterjs-alignment', `blasterjs-${letter !== ' ' ? letter : '_'}`);
                    div.innerHTML = subject.charAt(i);
                    subjectDiv.appendChild(div);
                }
                subjectDiv.appendChild(endDiv);
                return subjectDiv;
            }
        }
    });
