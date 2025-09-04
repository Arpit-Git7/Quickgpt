import { request, response } from "express";
import Stripe from "stripe";
import Transaction from "../models/transaction.js";
import User from "../models/user.js";

export const stripeWebhooks =async(req,res)=>{
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY)
    const sig=request.headers['stripe-signature']
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch(error) {
        return response.status(400).send(`Webhook Error: ${error.message}`)
    }
    
    try {
        switch(event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const { transactionId, appId } = session.metadata;
                
                if(appId === 'quickgpt') {
                    const transaction = await Transaction.findOne({_id: transactionId, isPaid: false})
                    
                    if(transaction) {
                        // Update credits in user account
                        await User.updateOne({_id: transaction.userId}, {$inc: {credits: transaction.credits}})
                        // Update credit payment status
                        transaction.isPaid = true;
                        await transaction.save();
                    }
                } else {
                    return response.json({received: true, message: "Ignored event: Invalid app"})
                }
                break;
            }
            default:
                console.log("Unhandled event type:", event.type)
                break;
        }
        response.json({received: true})
    } catch(error) {
        console.error("Webhook processing error:", error)
        response.status(500).send("Internal Server Error")
    }
}
