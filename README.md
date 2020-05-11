# pothen-esxes
Greek Pothen Esxes CLI
## Usage
As from 2019, [hellenicparliament.gr](https://www.hellenicparliament.gr/Organosi-kai-Leitourgia/epitropi-elegxou-ton-oikonomikon-ton-komaton-kai-ton-vouleftwn/dilosi-periousiakis-katastasis-arxiki) is using Imprevas services to prevent users from scraping their content. Tthus, before scraping you must visit the website using a browser and save the appropriate cookies into a file.

To get the cookies, Open Developer Tools (F12) > Application > Storage > Cookies  > https://www.hellenicparliament.gr/.
The cookie file must look like this:
```bash
incap_ses_1170_2228038=XXX;agreeToCookies=1;incap_ses_477_2228038=XXX;visid_incap_2228038=XXX;cookiesession1=XXX;
```

```bash
Usage:  [options] [command]

Pothen Esxes CLI

Options:
  -V, --version               output the version number
  -h, --help                  output usage information

Commands:
  fetch [options] <baselink>  Fetch public URL and write table to CSV
  download [options]          Download Pothen Esxes files
  extract [options]           Extract Pothen Esxes values to CSV
```

### Pothen Esxes 2016 Example

```bash
# Fetch Pothe Esxes Data
pothen-esxes fetch -y 2016 -f pothenesxes \
    -c $(<cookie.txt) \
    https://www.hellenicparliament.gr//Organosi-kai-Leitourgia/epitropi-elegxou-ton-oikonomikon-ton-komaton-kai-ton-vouleftwn/Diloseis-Periousiakis-Katastasis2016

# Download PDF Files to folder pothenesxes
pothen-esxes download -y 2016 -f pothenesxes -c $(<cookie.txt)

# Extract fields and create CSV files
pothen-esxes extract -y 2016 -f pothenesxes -c $(<cookie.txt)
```
