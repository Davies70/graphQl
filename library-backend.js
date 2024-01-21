const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
// const { v1: uuid } = require('uuid')
const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
const Author = require('./models/author')
const Book = require('./models/book')
const { GraphQLError } = require('graphql')

require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to', MONGODB_URI)

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => console.log('error connection to MongoDB:', error.message))

const typeDefs = `
  type Book {
    title: String
    author: String!
    published: Int!
    genres: [String!]!
    id: ID!
  }

  type Author {
    name: String!
    born: Int
    id: ID!
    bookCount: Int
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allAuthors: [Author!]!
    allBooks(
      author: String
      genre: String
      ): [Book!]!
  }

  type Mutation {
  addBook(
    title: String!
    author: String!
    published: Int!
    genres: [String!]!
    ): Book!

  editAuthor(
    name: String!
    setBornTo: Int!
    ): Author
  }
`

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    authorCount: () => Author.collection.countDocuments(),
    allAuthors: async (roots, args) => {
      return Author.find({})
    },
    allBooks: async (roots, { author, genre }) => {
      if (author) {
        const foundAuthor = await Author.findOne({ name: author })
        if (foundAuthor) {
          const books = await Book.find({ author: foundAuthor._id })
          return books
        }
      }
      if (genre) {
        const books = await Book.find({ genres: { $all: [genre] } })
        return books
      }
    },
  },

  Mutation: {
    addBook: async (root, args) => {
      try {
        const author = await Author.findOne({ name: args.author })
        if (!author) {
          const newAuthor = new Author({ name: args.author })
          await newAuthor.save()
          const book = new Book({ ...args, author: newAuthor._id })
          return book.save()
        }
        const newBook = new Book({ ...args, author: author._id })
        return newBook.save()
      } catch (e) {
        throw new GraphQLError('Saving book failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.author,
            e,
          },
        })
      }
    },

    editAuthor: async (root, { name, setBornTo }) => {
      const author = await Author.findOne({ name })

      if (!author) {
        return null
      }
      try {
        const newAuthor = await Author.findByIdAndUpdate(
          author._id,
          {
            $set: { born: setBornTo },
          },
          { new: true }
        )
        return newAuthor
      } catch (e) {
        throw new GraphQLError('Saving date failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: setBornTo,
            e,
          },
        })
      }
    },
  },
}

// const createData = async (array) => {
//   for (b of array) {
//     let author = await Author.findOne({ name: b.author })
//     let mybook = await Book.findOne({ title: b.title })
//     if (!author && !mybook) {
//       let newAuthor = new Author({ name: b.author })
//       await newAuthor.save()
//       let newBook = new Book({ ...b, author: newAuthor._id })
//       await newBook.save()
//     }
//     if (!mybook) {
//       let book = new Book({ ...b, author: author._id })
//       await book.save()
//     }
//   }
// }

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})
