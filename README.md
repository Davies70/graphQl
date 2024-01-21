# Library Backend

This is a backend server for a library application. It's built with Node.js, Express, and GraphQL.

## Features

- Query for the total number of books (`bookCount`) and authors (`authorCount`).
- Query for all authors (`allAuthors`) and all books (`allBooks`).
- Filter books by author and genre.
- Add a new book with the `addBook` mutation.

## Installation

1. Clone this repository: `git clone <repository-url>`.
2. Install dependencies: `npm install`.
3. Start the server: `npm start`.

## Usage

The GraphQL API endpoint is at `/graphql`. You can use a tool like GraphiQL or Apollo Client to interact with the API.

Here's an example query:

```graphql
query {
  allBooks {
    title
    author
    published
    genres
  }
}
```

mutation {
addBook(
title: "New Book"
author: "Author Name"
published: 2022
genres: ["Genre1", "Genre2"]
) {
title
author
}
}
