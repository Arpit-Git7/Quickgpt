import Stripe from "stripe";
import Transaction from "../models/transaction.js";
import User from "../models/user.js";

export const stripeWebhooks = async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
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
                            // Attempt to update credits but don't break flow if it fails
                            await User.updateOne(
                                { _id: transaction.userId },
                                { $inc: { credits: transaction.credits } }
                            );
                        } catch (creditError) {
                            console.warn("Credits update failed:", creditError);
                        }

                        // Mark transaction as paid regardless of credits update
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

        // Always respond success to Stripe to prevent retries
        res.json({ received: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        // Still respond success to avoid retry loops, maybe log for later fixing
        res.json({ received: true, message: "Processing error, but continuing" });
    }
};