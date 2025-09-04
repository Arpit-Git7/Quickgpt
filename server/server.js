import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import connectDB from './configs/db.js'
import userRouter from './routes/userRoutes.js'
import chatRouter from './routes/chatRoutes.js'
import messageRouter from './routes/messageRoutes.js'
import creditRouter from './routes/creditRoutes.js'
import { stripeWebhooks } from './controllers/webhooks.js'

const app = express()
await connectDB()

// Stripe webhook → must use raw body
app.post('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhooks)

// Middleware
app.use(cors())
// JSON parser but skip stripe route
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe") {
    next()
  } else {
    express.json()(req, res, next)
  }
})

// Routes
app.get('/', (req, res) => res.send('Server is Live!'))
app.use('/api/user', userRouter)
app.use('/api/chat', chatRouter)
app.use('/api/message', messageRouter)
app.use('/api/credit', creditRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
