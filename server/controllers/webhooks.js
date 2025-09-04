import Stripe from "stripe";
import Transaction from "../models/transaction.js";
import User from "../models/user.js";

export const stripeWebhooks = async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        // req.rawBody must contain the raw payload from Stripe
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error("Webhook signature verification failed:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const { transactionId, appId } = session.metadata;

                if (appId === "quickgpt") {
                    const transaction = await Transaction.findOne({ _id: transactionId, isPaid: false });

                    if (transaction) {
                        try {
                            await User.updateOne(
                                { _id: transaction.userId },
                                { $inc: { credits: transaction.credits } }
                            );
                        } catch (creditError) {
                            console.warn("Credits update failed:", creditError);
                        }

                        transaction.isPaid = true;
                        await transaction.save();
                    }
                } else {
                    return res.json({ received: true, message: "Ignored event: Invalid app" });
                }
                break;
            }
            default:
                console.log("Unhandled event type:", event.type);
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.json({ received: true, message: "Processing error, but continuing" });
    }
};
