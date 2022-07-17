# CRUD plugin for Metarhia impress, metasql

## Description

This plugin contains features such as caching and hooks for CRUDs
It generates espoints for Metarhia impress application server with predifined configuration such as `metasql/crud` but rich featured

## Usage

Create file in impress application folder. `<yourFileName>.<version>.js`

File `example.1.js`:

```js
({
  plugin: 'oldendev/crud',
  database: db.pg,
  entities: {
    Doctor: ['get', 'select'],
    Patient: ['get', 'select'],
    Reason: ['get', 'select'],
  },
});
```
