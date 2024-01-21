const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
// const { v1: uuid } = require('uuid')
const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')
const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')

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
    me: User
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
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
  
  createUser(
    username: String!
    favoriteGenre: String!
  ): User
  
  login(
    username: String!
    password: String!
  ): Token
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
      const foundAuthor = await Author.findOne({ name: author })
      if (author && genre) {
        if (foundAuthor) {
          const books = await Book.find({
            author: foundAuthor._id,
            genres: { $all: [genre] },
          })
          return books
        }
      } else if (author) {
        if (foundAuthor) {
          const books = await Book.find({ author: foundAuthor._id })
          return books
        }
      } else if (genre) {
        const books = await Book.find({ genres: { $all: [genre] } })
        return books
      }
    },
    me: (root, args, context) => {
      return context.currentUser
    },
  },

  Author: {
    name: (root) => root.name,
    born: (root) => root.born,
    bookCount: async (root) => {
      const books = await Book.find({ author: root.id })
      return books.length
    },
    id: (root) => root.id,
  },

  Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currrentUser
      if (currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'BAD_USER_iNPUT',
          },
        })
      }
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

    editAuthor: async (root, { name, setBornTo }, { currentUser }) => {
      if (currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'BAD_USER_iNPUT',
          },
        })
      }
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

    createUser: async (root, { username, favoriteGenre }) => {
      const user = new User({
        username,
        favoriteGenre,
      })

      return user.save().catch((error) => {
        throw new GraphQLError('Creating the user failed', {
          extensions: {
            code: 'BAD_USE_INPUT',
            invalidArgs: args.username,
            error,
          },
        })
      })
    },

    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })

      if (!user || args.password !== 'secret') {
        throw new GraphQLError('wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        })
      }

      userForToken = {
        username: user.username,
        id: user._id,
      }

      return {
        value: jwt.sign(userForToken, process.env.JWT_SECRET, {
          expiresIn: '1h',
        }),
      }
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.startsWith('Bearer ')) {
      const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})
