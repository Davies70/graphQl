const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')
const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')

const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

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
          }).populate('author')
          return books
        }
      } else if (author) {
        if (foundAuthor) {
          const books = await Book.find({ author: foundAuthor._id })
          return books
        }
      } else if (genre) {
        const books = await Book.find({ genres: { $all: [genre] } }).populate(
          'author'
        )
        return books
      }
      return Book.find({}).populate('author')
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
      let book
      const currentUser = context.currentUser
      if (!currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'BAD_USER_iNPUT',
          },
        })
      }

      const author = await Author.findOne({ name: args.author })
      if (!author) {
        const newAuthor = new Author({ name: args.author })
        await newAuthor.save()
        book = new Book({ ...args, author: newAuthor._id })
      } else {
        book = new Book({ ...args, author: author._id })
      }

      try {
        await book.save()
      } catch (e) {
        throw new GraphQLError('Saving book failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.author,
            e,
          },
        })
      }
      book = await Book.findOne({ title: args.title }).populate('author')
      pubsub.publish('BOOK_ADDED', { bookAdded: book })
      return book
    },

    editAuthor: async (root, { name, setBornTo }, { currentUser }) => {
      if (!currentUser) {
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
          expiresIn: '1000h',
        }),
      }
    },
  },

  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator('BOOK_ADDED'),
    },
  },
}

module.exports = resolvers
