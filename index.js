#!/usr/bin/env node

const program = require('commander');
const request = require('request');
const cheerio = require('cheerio');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { Signale } = require('signale');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const LineByLineReader = require('line-by-line');
const pdf = require('pdf-table-extractor');
const pdfjs = require('pdfjs-dist');
const accounting = require('accounting');

const LEVEL = 'info';

const signale = new Signale({
    logLevel: LEVEL,
    stream: process.stdout,
    interactive: true,
    scope: 'pothen-esxes'
});


const toUpperCase = (str) => {
	if (!str) {
		return '';
	}
	str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	return str.toUpperCase();
};

const normalizeString = (str) => {
	let text = str.trim();

	text = text.replace(/<[^>]+>/g, '');
	text = text.replace(/<(?:.|\n)*?>/gm, '');
	text = text.replace(/<br>/gi, '\n');
	text = text.replace(/<p.*>/gi, '\n');
	text = text.replace(/<a.*href="(.*?)".*>(.*?)<\/a>/gi, " $2 (Link->$1) ");
	text = text.replace(/<(?:.|\s)*?>/g, '');
	text = text.replace(/[\r\n]+/g, '\n\n');
	text = text.replace(/ +/g, ' ');

	return text;
};

const replaceAll = (str, search, replace) => {
    return str.split(search).join(replace);
};

let CURRENCIES = [
    {
        name: 'ΛΕΒ',
        symbol: 'BGN',
        close: [
            {
                year: 2015,
                mult: 0.51
            },
            {
                year: 2016,
                mult: 0.51
            },
            {
                year: 2017,
                mult: 0.51
            },
            {
                year: 2018,
                mult: 0.51
            }
        ]
    },
    {
        name: 'ΔΟΛΑΡΙΟ ΗΠΑ|ΔΟΛΑΡΙΟ|ΗΠΑ',
        symbol: 'USD',
        close: [
            {
                year: 2015,
                mult: 0.92
            },
            {
                year: 2016,
                mult: 0.95
            },
            {
                year: 2017,
                mult: 0.83
            },
            {
                year: 2018,
                mult: 0.87
            }
        ]
    },
    {
        name: 'ΡΟΥΒΛΙ ΡΩΣΙΑΣ',
        symbol: 'RUB',
        close: [
            {
                year: 2015,
                mult: 0.0127
            },
            {
                year: 2016,
                mult: 0.0154
            },
            {
                year: 2017,
                mult: 0.0145
            },
            {
                year: 2018,
                mult: 0.0126
            }
        ]
    },
    {
        name: 'ΔΟΛΑΡΙΟ ΚΑΝΑΔΑ',
        symbol: 'CAD',
        close: [
            {
                year: 2015,
                mult: 0.6649
            },
            {
                year: 2016,
                mult: 0.7083
            },
            {
                year: 2017,
                mult: 0.6621
            },
            {
                year: 2018,
                mult: 0.6391
            }
        ]
    },
    {
        name: 'ΒΡΕΤΑΝΙΚΗ ΛΙΡΑ',
        symbol: 'GBP',
        close: [
            {
                year: 2015,
                mult: 1.3571
            },
            {
                year: 2016,
                mult: 1.1732
            },
            {
                year: 2017,
                mult: 1.1256
            },
            {
                year: 2018,
                mult: 1.1092
            }
        ]
    },
    {
        name: 'ΔΟΛΑΡΙΟ ΑΥΣΤΡΑΛΙΑΣ|ΔΟΛΑΡΙΟ ΑΥΣΤΡΑΛΙΑ|ΑΥΣΤΡΑΛΙΑΣ',
        symbol: 'AUD',
        close: [
            {
                year: 2015,
                mult: 0.6706
            },
            {
                year: 2016,
                mult: 0.6857
            },
            {
                year: 2017,
                mult: 0.6498
            },
            {
                year: 2018,
                mult: 0.6126
            }
        ]
    },
    {
        name: 'ΕΛΒΕΤΙΚΟ ΦΡΑΓΚΟ',
        symbol: 'CHF',
        close: [
            {
                year: 2015,
                mult: 0.9187
            },
            {
                year: 2016,
                mult: 0.9339
            },
            {
                year: 2017,
                mult: 0.8553
            },
            {
                year: 2018,
                mult: 0.8844
            }
        ]
    },
    {
        name: 'ΚΟΡΟΝΑ ΣΟΥΗΔΙΑΣ*',
        symbol: 'SEK',
        close: [
            {
                year: 2015,
                mult: 0.10918
            },
            {
                year: 2016,
                mult: 0.1047
            },
            {
                year: 2017,
                mult: 0.1019
            },
            {
                year: 2018,
                mult: 0.0973
            }
        ]
    },
    {
        name: 'ΝΕΟ ΡΟΥΜΑΝΙΚΟ ΛΕΟΥ*',
        symbol: 'RON',
        close: [
            {
                year: 2015,
                mult: 0.2215
            },
            {
                year: 2016,
                mult: 0.2215
            },
            {
                year: 2017,
                mult: 0.2144
            },
            {
                year: 2018,
                mult: 0.2141
            }
        ]
    },
    {
        name: 'ΔΗΝΑΡΙΟ ΣΕΡΒΙΑΣ',
        symbol: 'RSD',
        close: [
            {
                year: 2015,
                mult: 0.0082
            },
            {
                year: 2016,
                mult: 0.00814
            },
            {
                year: 2017,
                mult: 0.00846
            },
            {
                year: 2018,
                mult: 0.00848
            }
        ]
    },
    {
        name: 'ΓΙΕΝ',
        symbol: 'JPY',
        close: [
            {
                year: 2015,
                mult: 0.0077
            },
            {
                year: 2016,
                mult: 0.0081
            },
            {
                year: 2017,
                mult: 0.0074
            },
            {
                year: 2018,
                mult: 0.0079
            }
        ]
    },
    {
        name: 'ΚΟΡΟΝΑ ΝΟΡΒΗΓΙΑΣ*',
        symbol: 'NOK',
        close: [
            {
                year: 2015,
                mult: 0.10394
            },
            {
                year: 2016,
                mult: 0.11004
            },
            {
                year: 2017,
                mult: 0.1016
            },
            {
                year: 2018,
                mult: 0.1005
            }
        ]
    },
    {
        name: 'ΡΑΝΤ',
        symbol: 'ZAR',
        close: [
            {
                year: 2015,
                mult: 0.0595
            },
            {
                year: 2016,
                mult: 0.0693
            },
            {
                year: 2017,
                mult: 0.0677
            },
            {
                year: 2018,
                mult: 0.0606
            }
        ]
    },
    {
        name: 'ΡΟΥΒΛΙ ΛΕΥΚΟΡΩΣΙΑΣ',
        symbol: 'BYΝ',
        close: [
            {
                year: 2015,
                mult: 0.50
            },
            {
                year: 2016,
                mult: 0.49
            },
            {
                year: 2017,
                mult: 0.42
            },
            {
                year: 2018,
                mult: 0.40
            }
        ]
    },
    {
        name: 'ΝΕΑ ΤΟΥΡΚΙΚΗ ΛΙΡΑ',
        symbol: 'TRY',
        close: [
            {
                year: 2015,
                mult: 0.3153
            },
            {
                year: 2016,
                mult: 0.2704
            },
            {
                year: 2017,
                mult: 0.2215
            },
            {
                year: 2018,
                mult: 0.1647
            }
        ]
    }
];

const createDir = (p) => {
    signale.info(`Create folder ${p}`);
    if (!fs.existsSync(p)){
        fs.mkdir(p, { recursive: true }, (err) => {
            if (err) {
                signale.error(err)
                process.exit(0);
            }
        });
        signale.info(`Folder ${p} created`);
    } else {
        signale.info(`Folder ${p} exists`);
    }
};

const downloadFile = (url, dest, cookie, cb) => {
    if (fs.existsSync(dest)) return cb();
    if (!url) return cb(new Error('URL doesn\'t exists'));

    const file = fs.createWriteStream(dest);

    const sendReq = request({
        url: url,
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
            'Accept-Encoding': 'none',
            'Accept-Language': 'en-US,en;q=0.8',
            'Connection': 'keep-alive'
        }
    });

    // verify response code
    sendReq.on('response', (response) => {
        if (response.statusCode !== 200) {
            return cb(response);
        }
        // response.setHeader("Content-Type", "text/pdf");
        sendReq.pipe(file);
    });

    // close() is async, call cb after close completes
    file.on('finish', () => file.close(cb));

    // check for request errors
    sendReq.on('error', (err) => {
        return cb(err);
    });

    file.on('error', (err) => { // Handle errors
        return cb(err);
    });
};

const fetch = (baselink, cmd) => {
    signale.debug(`Fetch process started`);

    // Create base dir
    const folder = path.join(cmd.folder, cmd.year);
    createDir(folder);

    // Fetch baselink
    signale.debug(`Fetch baselink`);

    request({
            url: baselink,
            headers: {
                'Cookie': cmd.cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
                'Accept-Encoding': 'none',
                'Accept-Language': 'en-US,en;q=0.8',
                'Connection': 'keep-alive'
            }
        }, (err, res, body) => {
        if (err) {
            signale.error(err)
            process.exit(0);
        }

        const csvWriter = createCsvWriter({
            path: path.join(folder, '_all.csv'),
            header: [
                { id: 'surname', title: 'surname' },
                { id: 'name', title: 'name' },
                { id: 'link', title: 'link' },
                { id: 'folder', title: 'folder' },
                { id: 'pdf', title: 'pdf' },
                { id: 'csv', title: 'csv' }
            ]
        });

        let members = [];

        // Load HTML body into cheerio
        let $ = cheerio.load(body);

        // Extract Fields with Cheerio
        // Scrape Name, Lastname, File
        $(`table tbody tr`).each((i, val) => {
            let td = $(val).children('td');
            members.push({
                surname: $(td).eq(0).text(),
                name: $(td).eq(1).text(),
                link: $(td).eq(2).find('a').attr('href'),
                folder: folder,
                pdf: $(td).eq(2).find('a').attr('href').replace(/^.*[\\\/]/, ''),
                csv: $(td).eq(2).find('a').attr('href').replace(/^.*[\\\/]/, '').replace('.pdf', '.csv')
            });
        });
        // Write Table to CSV
        csvWriter
            .writeRecords(members)
            .then(() => {
                signale.info(`CSV was written successfully under ${path.join(folder, '_all.csv')}`);
                signale.info('All data fetched');
                process.exit(0);
            })
            .catch((err) => {
                signale.error(`Error while writing CSV ${err.message}`);
                process.exit(0);
            });
    });

};

const download = (cmd) => {
    const folder = path.join(cmd.folder, cmd.year);

    createDir(path.join(folder, 'pdf'));

    const file = path.join(folder, '_all.csv');
    signale.debug(`Reading file ${file}`);

    lr = new LineByLineReader(file);

    let TOTAL = fs.readFileSync(file).toString().split('\n').length;
    let L = 0;

    lr.on('line', (line) => {
        const columns = line.split(',');
        if (columns[0] === 'surname') return;

        lr.pause();
        signale.await('[%d/%d] - Downloading Pothen Esxes %s %s', L+1, TOTAL-1, columns[0], columns[1]);
        downloadFile(
            columns[2],
            path.join(columns[3], 'pdf', columns[4]),
            cmd.cookie,
            (err) => {
                if (err) {
                    signale.error(`Error while downloading file ${columns[0]} ${columns[1]} ${err.message}`)
                }
                L++;
                lr.resume();
            }
        );
    });
    lr.on('error', (err) => {
        signale.error(`Error on line ${L} ${err.message}`);
        process.exit(0);
    });
    lr.on('end', () => {
        signale.info('All files downloaded');
        process.exit(0);
    });
};

const extract = (cmd) => {
    const folder = path.join(cmd.folder, cmd.year);

    createDir(path.join(folder, 'txt'));

    const file = path.join(folder, '_all.csv');
    signale.debug(`Reading file ${file}`);

    lr = new LineByLineReader(file);

    let TOTAL = fs.readFileSync(file).toString().split('\n').length;
    let L = 0;

    let T = 0;
    let D = 0;
    let I = 0;
    let S = 0;
    let M = 0;

    const csvWriter = createCsvWriter({
        path: path.join(folder, '_sum.csv'),
        header: [
            { id: 'surname', title: 'ΕΠΩΝΥΜΟ' },
            { id: 'name', title: 'ΟΝΟΜΑ' },
            { id: 'fathersname', title: 'ΟΝΟΜΑ ΠΑΤΡΟΣ' },

            { id: 'spouse_name', title: 'ΕΠΩΝΥΜΟ (Συζύγου)' },
            { id: 'spouse_surname', title: 'ΟΝΟΜΑ (Συζύγου)' },
            { id: 'spouse_fathersname', title: 'ΟΝΟΜΑ ΠΑΤΡΟΣ (Συζύγου)' },

            { id: 'loansSum', title: 'ΔΑΝΕΙΑ ΑΡΧΙΚΟ ΠΟΣΟ (Σύνολο)' },
            { id: 'loansDue', title: 'ΔΑΝΕΙΑ ΥΠΟΛΟΙΠΟ ΟΦΕΙΛΟΜΕΝΟ (Σύνολο)' },
            
            { id: 'income', title: 'ΕΣΟΔΑ (Σύνολο)' },
            { id: 'deposits', title: 'ΚΑΤΑΘΕΣΕΙΣ (Σύνολο)' },
            { id: 'accounts', title: 'ΑΡΙΘΜΟΣ ΤΡΑΠΕΖΙΚΩΝ ΛΟΓΑΡΙΑΣΜΩΝ (Σύνολο)' },
            { id: 'properties', title: 'ΑΚΙΝΗΤΑ (Σύνολο)' },
            { id: 'propertiesArea', title: 'ΕΠΙΦΑΝΕΙΑ ΣΕ Μ2 (Σύνολο)' },
            { id: 'sharesAmount', title: 'ΜΕΤΟΧΕΣ ΑΠΟΤΙΜΗΣΗ (Σύνολο)' },
            { id: 'sharesCount', title: 'ΜΕΤΟΧΕΣ ΠΟΣΟΤΗΤΑ (Σύνολο)' },

            { id: 'link', title: 'PDF Link' }
            // { id: 'loansCreated', title: 'ΗΜ/ΝΙΑ ΔΗΜΙΟΥΡΓΙΑΣ ΥΠΟΧΡΕΩΣΗΣ' },
            // { id: 'loansEnding', title: 'ΗΜ/ΝΙΑ ΛΗΞΗΣ ΥΠΟΧΡΕΩΣΗΣ' },
        ]
    });

    let sum = [];

    lr.on('line', (line) => {
        const columns = line.split(',');
        if (columns[0] === 'surname') return;

        let pdfFile = path.join(columns[3], 'pdf', columns[4]);
        let txtFile = path.join(columns[3], 'txt', columns[5]);

        lr.pause();
        signale.await('[%d/%d] - Processing %s %s', L+1, TOTAL-1, columns[0], columns[1]);

        let tbl = '';

        const getElected = async () => {
            return pdfjs.getDocument(pdfFile).promise.then(p => {
                return p.getPage(1).then(page => {
                    return page.getTextContent().then(textContent => {
                        let strings = textContent.items.map(m => toUpperCase(normalizeString(m.str.replace(':', ''))));
                        strings = strings.filter(Boolean);
                        const elected = {
                            name: strings[strings.findIndex(m => m === 'ΟΝΟΜΑ') + 1],
                            surname: strings[strings.findIndex(m => m === 'ΕΠΩΝΥΜΟ') + 1],
                            fathersname: strings[strings.findIndex(m => m.includes('ΠΑΤΡΟΣ')) + 1],
                            spouse_name: '',
                            spouse_surname: '',
                            spouse_fathersname: ''
                        };

                        strings = strings.slice(strings.findIndex(m => m.includes('ΠΑΤΡΟΣ')) + 2);
                        if (new RegExp(['ΟΝΟΜΑ', 'ΠΑΤΡΟΣ', 'ΕΠΩΝΥΜΟ'].join('|')).test(strings[strings.findIndex(m => m === 'ΟΝΟΜΑ') + 1])) {
                            return elected;
                        }

                        elected.spouse_name = strings[strings.findIndex(m => m === 'ΟΝΟΜΑ') + 1];
                        elected.spouse_surname = strings[strings.findIndex(m => m === 'ΕΠΩΝΥΜΟ') + 1];
                        elected.spouse_fathersname = strings[strings.findIndex(m => m.includes('ΠΑΤΡΟΣ')) + 1];
    
                        return elected;
                    });
                });
            });
        };

        getElected().then(elected => {
            pdf(pdfFile, (data) => {
                let str = JSON.stringify(data);
            
                str = str.replace(/(\r\n|\n|\r)/gm, " ");
                str = str.replace(/\s+/g, " ");
                
                // έσοδα και καταθέσεις
                let income = 0;
                let savings = 0;
                let A = 0;
                let BA = 0;
                for (var i = 0; i < data.pageTables.length; i++) {
                    let header = data.pageTables[i].tables[0];
                    let tables = _.map(data.pageTables[i].tables, (m) => {
                        let row = _.map(m, (n) => {
                            let s = n.replace(/(\r\n|\n|\r)/gm, ' ').trim();
                            s = s.replace(/\\/g, ' ');
                            s = s.replace(/\//g, ' / ');
                            s = s.replace(/\=/g, ' = ');
                            s = s.replace(/\s\s+/g, ' ');
                            s = toUpperCase(s);
                            s = normalizeString(s);
                            return '"' + s + '"';
                        });
                        tbl += `${row}\n`;
                        return row;
                    });
                    tbl += `\n`;

                    let idx = _.indexOf(header, 'ΠΟΣΟ');
                    if (idx < 0) continue;
                    for (var j = 1; j < data.pageTables[i].tables.length; j++) {
                        let currencyName = replaceAll(data.pageTables[i].tables[j][idx + 1], '\n', '').trim();
                        let currencyIndex = _.findIndex(CURRENCIES, m => new RegExp(m.name).test(currencyName));
                        let currencyMultiplier = currencyIndex < 0 ? 1 : _.find(CURRENCIES[currencyIndex].close, ['year', parseInt(cmd.year) - 1]).mult;

                        let amount = accounting.unformat(data.pageTables[i].tables[j][idx].trim(), ',') * currencyMultiplier;

                        if (currencyIndex === -1 && currencyName !== 'ΕΥΡΩ' && currencyName !== '') signale.debug('Missing Currency "' +currencyName + '"');
                        if (currencyName !== 'ΕΥΡΩ' && currencyName !== '') {
                            signale.debug(`INCOME/SAVINGS Convert ${CURRENCIES[currencyIndex].symbol} to EUR => ${accounting.unformat(data.pageTables[i].tables[j][idx].trim(), ',')} => ${amount}`);
                        }

                        if (A === 0) {
                            income += amount;
                        } else {
                            savings += amount
                            BA++;
                        }
                    }
                    A++;
                }

                // δάνεια
                let lastPage = data.pageTables[data.pageTables.length - 1].tables;
                let total = 0;
                let due = 0;
                let from = [];
                let to = [];
                _.each(lastPage, (m, j) => {
                    if (j > 0) {
                        let currencyName = replaceAll(m[4], '\n', '').trim();
                        let currencyIndex = _.findIndex(CURRENCIES, m => new RegExp(m.name).test(currencyName));
                        let currencyMultiplier = currencyIndex < 0 ? 1 : _.find(CURRENCIES[currencyIndex].close, ['year', parseInt(cmd.year) - 1]).mult;

                        if (currencyIndex === -1 && currencyName !== 'ΕΥΡΩ' && currencyName !== '') signale.debug('Missing Currency "' +currencyName + '"');
                        if (currencyName !== 'ΕΥΡΩ' && currencyName !== '') {
                            signale.debug(`LOANS/TOTAL Convert ${CURRENCIES[currencyIndex].symbol} to EUR => ${accounting.unformat(m[3].trim(), ',')} => ${accounting.unformat(m[3].trim(), ',') * currencyMultiplier}`);
                            signale.debug(`LOANS/DUE Convert ${CURRENCIES[currencyIndex].symbol} to EUR => ${accounting.unformat(m[5].trim(), ',')} => ${accounting.unformat(m[5].trim(), ',') * currencyMultiplier}`);
                        }

                        total += accounting.unformat(m[3].trim(), ',') * currencyMultiplier;
                        due += accounting.unformat(m[5].trim(), ',') * currencyMultiplier;

                        if (m[6] !== '') {
                            from.push(m[6].trim())
                        }
                        if (m[7] !== '') {
                            to.push(m[7].trim())
                        }
                    }
                });
                // ακίνητα
                let PRP = 0;
                let TM = 0;
                for (var q = 0; q < data.pageTables.length; q++) {
                    let header = data.pageTables[q].tables[0];
                    let idxq = _.indexOf(header, 'ΕΙΔΟΣ \nΑΚΙΝΗΤΟΥ');
                    if (idxq < 0) continue;
                    for (var w = 1; w < data.pageTables[q].tables.length; w++) {
                        let tm = (accounting.unformat(data.pageTables[q].tables[w][11], ',') || 0) + (accounting.unformat(data.pageTables[q].tables[w][12], ',') || 0);
                        tm = tm === 0 ? (accounting.unformat(data.pageTables[q].tables[w][9], ',') || 0) : tm;
                        TM += tm;
                        PRP++;
                    }
                }

                // μετοχές
                let mtxCost = 0;
                let mtxCount = 0;
                for (var e = 0; e < data.pageTables.length; e++) {
                    let header = data.pageTables[e].tables[0];
                    let idxe = _.indexOf(header, 'ΑΠΟΤΙΜΗΣΗ');
                    if (idxe < 0) continue;

                    for (var r = 1; r < data.pageTables[e].tables.length; r++) {
                        if (data.pageTables[e].tables[r][idxe + 2].trim() === 'Σ') continue;

                        let currencyName = replaceAll(data.pageTables[e].tables[r][idxe + 2], '\n', '').trim();
                        let currencyIndex = _.findIndex(CURRENCIES, m => new RegExp(m.name).test(currencyName));
                        let currencyMultiplier = currencyIndex < 0 ? 1 : _.find(CURRENCIES[currencyIndex].close, ['year', parseInt(cmd.year) - 1]).mult;

                        if (currencyIndex === -1 && currencyName !== 'ΕΥΡΩ' && currencyName !== '') signale.debug('Missing Currency "' +currencyName + '"');
                        if (currencyName !== 'ΕΥΡΩ' && currencyName !== '') {
                            signale.debug(`STOCKS Convert ${CURRENCIES[currencyIndex].symbol} to EUR => ${accounting.unformat(data.pageTables[e].tables[r][idxe].trim(), ',')} => ${accounting.unformat(data.pageTables[e].tables[r][idxe].trim(), ',') * currencyMultiplier}`);
                        }

                        mtxCost += accounting.unformat(data.pageTables[e].tables[r][idxe].trim(), ',') * currencyMultiplier;
                        mtxCount += accounting.unformat(data.pageTables[e].tables[r][idxe - 3].trim(), ',') * currencyMultiplier;
                    }
                }

                T += total;
                D += due;
                I += income;
                S += savings;
                M += mtxCost;

                sum.push({
                    ...elected,
                    loansSum: accounting.formatMoney(total, { symbol: '€',  format: '%v %s' }, 2),
                    loansDue: accounting.formatMoney(due, { symbol: '€',  format: '%v %s' }, 2),
                   
                    income: accounting.formatMoney(income, { symbol: '€',  format: '%v %s' }, 2),
                    deposits: accounting.formatMoney(savings, { symbol: '€',  format: '%v %s' }, 2),
                    accounts: BA,
                    properties: PRP,
                    propertiesArea: accounting.formatNumber(TM, 2),
                    sharesAmount: accounting.formatMoney(mtxCost, { symbol: '€',  format: '%v %s' }, 2),
                    sharesCount: accounting.formatNumber(mtxCount, 2),

                    link: columns[2]

                    // loansCreated: from.join(','),
                    // loansEnding: to.join(','),
                });

                fs.writeFile(txtFile, tbl, (err) => {
                    if (err) {
                        signale.error(`Error writing TXT ${L} ${err.message}`);
                    }
                    L++;
                    lr.resume();
                });
            }, (err) => {
                signale.error(`Error while extracting data table ${L} ${err.message}`);
                L++;
                lr.resume();
            });
        }).catch(err => {
            signale.error(`Error while extracting mp data ${L} ${err.message}`);
            L++;
            lr.resume();
        });
    });

    lr.on('error', (err) => {
        signale.error(`Error on line ${L} ${err.message}`);
        L++;
        lr.resume();
    });

    lr.on('end', () => {
        // Write Table to CSV
        csvWriter
            .writeRecords(sum)
            .then(() => {
                signale.info(`CSV was written successfully under ${path.join(folder, '_sum.csv')}`);
                signale.info('All files extracted');
                process.exit(0);
            })
            .catch((err) => {
                signale.error(`Error while writing CSV ${err.message}`);
                process.exit(0);
            });
    });
};

program
    .version('1.1.0')
    .description('Pothen Esxes CLI');

program
    .command('fetch <baselink>')
    .option('-y, --year [value]', 'Current Year')
    .option('-f, --folder [value]', 'Output Folder', './pothenesxes')
    .option('-c, --cookie [value]', 'Cookie', '')
    .description('Fetch public URL and write table to CSV')
    .action(fetch);

program
    .command('download')
    .option('-y, --year [value]', 'Current Year')
    .option('-f, --folder [value]', 'Output Folder', './pothenesxes')
    .option('-c, --cookie [value]', 'Cookie', '')
    .description('Download Pothen Esxes files')
    .action(download);

program
    .command('extract')
    .option('-y, --year [value]', 'Current Year')
    .option('-f, --folder [value]', 'Output Folder', './pothenesxes')
    .description('Extract Pothen Esxes values to CSV')
    .action(extract);

// Assert that a VALID command is provided
if (!process.argv.slice(2).length || !/[arudl]/.test(process.argv.slice(2))) {
    program.outputHelp();
    process.exit();
}

program.parse(process.argv);
