# Book Assist

Book Assist is a TanStack Start + React library-management application powered by Appwrite.

## Backend

The application uses Appwrite for:
- Email/password authentication
- Librarian profiles and codes
- Books, students, and transaction records
- Private per-user database permissions
- Student face-image records

## Appwrite project configuration

Set these public build-time variables:

- `VITE_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1`
- `VITE_APPWRITE_PROJECT_ID=6af5898800380ce90092`

The Appwrite project must contain the `book_assist_db` database with the `librarians`, `books`, `students`, and `transactions` tables. Student face images are stored in the private `face_image` database field.

Do not add an Appwrite API key to any `VITE_*` variable or browser code.

## Development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
```

The Appwrite Site uses the `appwrite-migration` branch, Node.js 22, and the Nitro output directory `.output`.
