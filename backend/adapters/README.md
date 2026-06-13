# Storage Adapters

Storage adapters implement the persistence contract used by
`backend/collection-service.js` and `backend/backup-service.js`.

Required methods:

- `listCollection(collectionName, authContext)`
- `getItem(collectionName, itemId, authContext)`
- `replaceCollection(collectionName, items, authContext)`
- `upsertItem(collectionName, itemId, item, authContext)`
- `deleteItem(collectionName, itemId, authContext)`
- `exportScope(authContext)`
- `importScope(scopedData, authContext)`

`file-adapter.js` is the current local development adapter.
`firebase-admin-adapter.js` is the production Firestore adapter selected with:

```text
BANIK_STORAGE_ADAPTER=firebase
```

`postgres-adapter.js` is a documented placeholder for a future SQL adapter.
