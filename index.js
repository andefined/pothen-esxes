#!/usr/bin/env node

const program = require('commander');
const request = require('request');
const cheerio = require('cheerio');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { Signale } = require('signale');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const LineByLineReader = require('line-by-line');
const pdf = require('pdf-table-extractor');
const accounting = require('accounting');

const signale = new Signale({
    logLevel: 'info',
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


let CURRENCIES = [
    { name: 'ΕΥΡΩ', mult: 1.0 },
    { name: 'ΛΕΒ', mult: 0.51 },
    { name: 'ΔΟΛΑΡΙΟ ΗΠΑ', mult: 0.88 },
    { name: 'ΔΟΛΑΡΙΟ \nΗΠΑ', mult: 0.88 },
    { name: 'ΔΟΛΑΡΙΟ', mult: 0.88 },
    { name: 'ΗΠΑ', mult: 0.88 },
    { name: '', mult: 1.0 },
    { name: 'ΡΟΥΒΛΙ ΡΩΣΙΑΣ', mult: 0.014 },
    { name: 'ΔΟΛΑΡΙΟ ΚΑΝΑΔΑ', mult: 0.66 },
    { name: 'ΔΟΛΑΡΙΟ \nΚΑΝΑΔΑ', mult: 0.66 },
    { name: 'ΒΡΕΤΑΝΙΚΗ ΛΙΡΑ', mult: 1.15 },
    { name: 'ΒΡΕΤΑΝΙΚΗ \nΛΙΡΑ', mult: 1.15 },
    { name: 'ΕΛΒΕΤΙΚΟ \nΦΡΑΓΚΟ', mult: 0.88 },
    { name: 'ΕΛΒΕΤΙΚΟ ΦΡΑΓΚΟ', mult: 0.88 },
    { name: 'ΔΟΛΑΡΙΟ \nΑΥΣΤΡΑΛΙΑΣ', mult: 0.63 },
    { name: 'ΔΟΛΑΡΙΟ ΑΥΣΤΡΑΛΙΑΣ', mult: 0.63 },
    { name: 'ΔΟΛΑΡΙΟ \nΑΥΣΤΡΑΛΙΑ\nΣ', mult: 0.63 },
    { name: 'ΚΟΡΟΝΑ\nΝΟΡΒΗΓΙΑΣ\n(KRONE)', mult: 0.10 },
    { name: 'ΚΟΡΟΝΑ \nΝΟΡΒΗΓΙΑΣ \n(KRONE)', mult: 0.10 },
    { name: 'ΚΟΡΟΝΑ \nΝΟΡΒΗΓΙΑΣ', mult: 0.10 },
    { name: 'ΚΟΡΟΝΑ ΝΟΡΒΗΓΙΑΣ', mult: 0.10 },
    { name: '(KRONE)', mult: 0.10 },
    { name: 'ΚΟΡΟΝΑ \nΣΟΥΗΔΙΑΣ \n(KRONA)', mult: 0.10 },
    { name: 'ΝΕΟ ΡΟΥΜΑΝΙΚΟ \nΛΕΟΥ [19]', mult: 0.21 },
    { name: 'ΔΗΝΑΡΙΟ ΣΕΡΒΙΑΣ', mult: 0.0085 },
    { name: 'ΓΙΕΝ', mult: 0.0079 },
    { name: 'ΡΑΝΤ', mult: 0.0063 },
    { name: 'ΡΟΥΒΛΙ \nΛΕΥΚΟΡΩΣΙΑΣ', mult: 0.42 }
];

const createDir = (p) => {
    signale.info(`Create folder ${p}`);
    if (!fs.existsSync(p)){
        fs.mkdir(p, { reCURRENCIESive: true }, (err) => {
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

const downloadFile = (url, dest, cb) => {
    if (fs.existsSync(dest)) return cb();
    if (!url) return cb(new Error('URL doesn\'t exists'));

    const file = fs.createWriteStream(dest);

    const sendReq = request.get(url);

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
    signale.debug(`Extraction process started`);

    // Create base dir
    const folder = path.join(cmd.folder, cmd.year);
    createDir(folder);

    // Fetch baselink
    signale.debug(`Fetch baselink`);
    request(baselink, (err, res, body) => {
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

    createDir(path.join(folder, 'csv'));

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
            { id: 'loansSum', title: 'ΔΑΝΕΙΑ ΑΡΧΙΚΟ ΠΟΣΟ' },
            { id: 'loansDue', title: 'ΔΑΝΕΙΑ ΥΠΟΛΟΙΠΟ ΟΦΕΙΛΟΜΕΝΟ' },
            { id: 'loansCreated', title: 'ΗΜ/ΝΙΑ ΔΗΜΙΟΥΡΓΙΑΣ ΥΠΟΧΡΕΩΣΗΣ' },
            { id: 'loansEnding', title: 'ΗΜ/ΝΙΑ ΛΗΞΗΣ ΥΠΟΧΡΕΩΣΗΣ' },
            { id: 'income', title: 'ΕΣΟΔΑ' },
            { id: 'deposits', title: 'ΚΑΤΑΘΕΣΕΙΣ' },
            { id: 'accounts', title: 'ΑΡΙΘΜΟΣ ΤΡΑΠΕΖΙΚΩΝ ΛΟΓΑΡΙΑΣΜΩΝ' },
            { id: 'properties', title: 'ΑΚΙΝΗΤΑ' },
            { id: 'sharesAmount', title: 'ΜΕΤΟΧΕΣ ΑΠΟΤΙΜΗΣΗ' },
            { id: 'sharesCount', title: 'ΜΕΤΟΧΕΣ ΠΟΣΟΤΗΤΑ' }
        ]
    });

    let sum = [];

    lr.on('line', (line) => {
        const columns = line.split(',');
        if (columns[0] === 'surname') return;

        let pdfFile = path.join(columns[3], 'pdf', columns[4]);
        let csvFile = path.join(columns[3], 'csv', columns[5]);

        lr.pause();
        signale.await('[%d/%d] - Processing %s %s', L+1, TOTAL-1, columns[0], columns[1]);

        let tbl = '';

        pdf(pdfFile, (data) => {
            let str = JSON.stringify(data);

            str = str.replace(/(\r\n|\n|\r)/gm, " ");
            str = str.replace(/\s+/g, " ");

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
                    let cur = _.findIndex(CURRENCIES, { name: data.pageTables[i].tables[j][idx + 1].trim() });
                    if (A === 0) {
                        income += accounting.unformat(data.pageTables[i].tables[j][idx].trim(), ',') * CURRENCIES[cur].mult;
                    } else {
                        savings += accounting.unformat(data.pageTables[i].tables[j][idx].trim(), ',') * CURRENCIES[cur].mult;
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
                    let curp = _.findIndex(CURRENCIES, { name: m[4].trim() });
                    total += accounting.unformat(m[3].trim(), ',') * CURRENCIES[curp].mult;
                    due += accounting.unformat(m[5].trim(), ',') * CURRENCIES[curp].mult;
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
            for (var q = 0; q < data.pageTables.length; q++) {
                let header = data.pageTables[q].tables[0];
                let idxq = _.indexOf(header, 'AA');
                if (idxq < 0) continue;

                for (var w = 1; w < data.pageTables[q].tables.length; w++) {
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
                    let curr = _.findIndex(CURRENCIES, { name: data.pageTables[e].tables[r][idxe + 2].trim() });
                    if (curr === -1) signale.info('"' + data.pageTables[e].tables[r][idxe + 2].trim() + '"');
                    mtxCost += accounting.unformat(data.pageTables[e].tables[r][idxe].trim(), ',') * CURRENCIES[curr].mult;
                    mtxCount += accounting.unformat(data.pageTables[e].tables[r][idxe - 3].trim(), ',') * CURRENCIES[curr].mult;
                }
            }

            T += total;
            D += due;
            I += income;
            S += savings;
            M += mtxCost;

            sum.push({
                surname: columns[0],
                name: columns[1],
                loansSum: accounting.formatMoney(total, "", 2, ".", ","),
                loansDue: accounting.formatMoney(due, "", 2, ".", ","),
                loansCreated: from.join(','),
                loansEnding: to.join(','),
                income: accounting.formatMoney(income, "", 2, ".", ","),
                deposits: accounting.formatMoney(savings, "", 2, ".", ","),
                accounts: BA,
                properties: PRP,
                sharesAmount: accounting.formatMoney(mtxCost, "", 2, ".", ","),
                sharesCount: accounting.formatMoney(mtxCount, "", 2, ".", ",")
            });

            fs.writeFile(csvFile, tbl, (err) => {
                if (err) {
                    signale.error(`Error writing CSV ${L} ${err.message}`);
                }
                L++;
                lr.resume();
            });
        }, (err) => {
            signale.error(`Error while extracting data table ${L} ${err.message}`);
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
    .version('1.0.0')
    .description('Pothen Esxes CLI');

program
    .command('fetch <baselink>')
    .option('-y, --year [value]', 'Current Year')
    .option('-f, --folder [value]', 'Output Folder', './pothenesxes')
    .description('Fetch public URL and write table to CSV')
    .action(fetch);

program
    .command('download')
    .option('-y, --year [value]', 'Current Year')
    .option('-f, --folder [value]', 'Output Folder', './pothenesxes')
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
