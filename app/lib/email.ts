/**
 * Email service for sending referral notifications via Resend
 * 
 * Handles:
 * - Referral used notifications (when someone uses their code)
 * - Credit awarded notifications (when store credit is granted)
 */

import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export interface ReferralUsedEmailData {
  referrerName: string;
  referrerEmail: string;
  creditAmount: number;
  orderNumber?: string;
  shopName: string;
}

export interface CreditAwardedEmailData {
  referrerName: string;
  referrerEmail: string;
  creditAmount: number;
  totalCredits: number;
  shopName: string;
}

/**
 * Send email notification when someone uses the referrer's code
 */
export async function sendReferralUsedEmail(
  data: ReferralUsedEmailData,
): Promise<boolean> {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || data.shopName;

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: data.referrerEmail,
      subject: `🎉 Someone used your referral code!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 28px;">🎉 Great News!</h1>
            </div>
            
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 18px; margin-top: 0;">
                Hi ${data.referrerName},
              </p>
              
              <p style="font-size: 16px;">
                Someone just used your referral code! 🎊
              </p>
              
              <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #10b981;">
                  You've earned $${data.creditAmount.toFixed(2)} in store credit!
                </p>
              </div>
              
              ${data.orderNumber ? `
                <p style="font-size: 14px; color: #6b7280;">
                  Order: ${data.orderNumber}
                </p>
              ` : ''}
              
              <p style="font-size: 16px;">
                Your store credit has been automatically added to your account. You can use it on your next purchase!
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://${data.shopName.replace('.myshopify.com', '')}.myshopify.com" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Shop Now
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                Thank you for being a valued customer and helping us grow!
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>Powered by Daisychain</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${data.referrerName},

Great news! Someone just used your referral code!

You've earned $${data.creditAmount.toFixed(2)} in store credit. Your credit has been automatically added to your account and you can use it on your next purchase.

${data.orderNumber ? `Order: ${data.orderNumber}\n\n` : ''}
Shop now: https://${data.shopName.replace('.myshopify.com', '')}.myshopify.com

Thank you for being a valued customer!

Powered by Daisychain
      `.trim(),
    });

    if (result.error) {
      console.error("Resend email error:", result.error);
      return false;
    }

    console.log(`Referral used email sent to ${data.referrerEmail}:`, result.data?.id);
    return true;
  } catch (error) {
    console.error("Error sending referral used email:", error);
    return false;
  }
}

/**
 * Send email notification when credit is awarded (can be used for other credit events)
 */
export async function sendCreditAwardedEmail(
  data: CreditAwardedEmailData,
): Promise<boolean> {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || data.shopName;

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: data.referrerEmail,
      subject: `💰 You've earned $${data.creditAmount.toFixed(2)} in store credit!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 28px;">💰 Store Credit Added!</h1>
            </div>
            
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 18px; margin-top: 0;">
                Hi ${data.referrerName},
              </p>
              
              <p style="font-size: 16px;">
                We've added store credit to your account!
              </p>
              
              <div style="background: #f0fdf4; border: 2px solid #10b981; padding: 24px; margin: 24px 0; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                  Credit Added
                </p>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #10b981;">
                  $${data.creditAmount.toFixed(2)}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
                  Total Balance: $${data.totalCredits.toFixed(2)}
                </p>
              </div>
              
              <p style="font-size: 16px;">
                You can use this credit on your next purchase. Just proceed to checkout and your credit will be automatically applied!
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://${data.shopName.replace('.myshopify.com', '')}.myshopify.com" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Start Shopping
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                Keep referring friends to earn more credit!
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>Powered by Daisychain</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${data.referrerName},

We've added store credit to your account!

Credit Added: $${data.creditAmount.toFixed(2)}
Total Balance: $${data.totalCredits.toFixed(2)}

You can use this credit on your next purchase. Just proceed to checkout and your credit will be automatically applied.

Start shopping: https://${data.shopName.replace('.myshopify.com', '')}.myshopify.com

Keep referring friends to earn more credit!

Powered by Daisychain
      `.trim(),
    });

    if (result.error) {
      console.error("Resend email error:", result.error);
      return false;
    }

    console.log(`Credit awarded email sent to ${data.referrerEmail}:`, result.data?.id);
    return true;
  } catch (error) {
    console.error("Error sending credit awarded email:", error);
    return false;
  }
}

