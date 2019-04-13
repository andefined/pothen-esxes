# pothen-esxes
Greek Pothen Esxes CLI

## Usage
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

Pothen Esxes 2016 Example

```bash
# Fetch Pothe Esxes Data
pothen-esxes fetch -y 2016 -f pothenesxes \
    https://www.hellenicparliament.gr//Organosi-kai-Leitourgia/epitropi-elegxou-ton-oikonomikon-ton-komaton-kai-ton-vouleftwn/Diloseis-Periousiakis-Katastasis2016

# Download PDF Files to folder pothenesxes
pothen-esxes download -y 2016 -f pothenesxes

# Extract fields and create CSV files
pothen-esxes extract -y 2016 -f pothenesxes
```
