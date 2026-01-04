use crate::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

#[derive(Deserialize, Default, PartialEq)]
pub struct DiscountConfig {
    pub referee_discount_percentage: f64,
    pub referee_min_order: f64,
    pub referrer_credit_amount: f64,
    pub min_referrer_orders: i32,
}

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: schema::cart_lines_discounts_generate_run::Input,
) -> Result<schema::CartLinesDiscountsGenerateRunResult> {
    // Check if discount has ORDER class
    let has_order_discount_class = input
        .discount()
        .discount_classes()
        .contains(&schema::DiscountClass::Order);

    if !has_order_discount_class {
        return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
    }

    // Get cart subtotal (needed for both discount types)
    let cart_subtotal = input
        .cart()
        .cost()
        .subtotal_amount()
        .amount()
        .as_f64();

    // Determine discount type by checking if discount has config metafield:
    // - Referral discount: has config metafield (contains discount configuration)
    // - Store credit discount: no config metafield (relies on customer credits)
    let has_config_metafield = input.discount().metafield().is_some();

    if has_config_metafield {
        // REFERRAL DISCOUNT LOGIC
        // Check if referral is validated
        let referral_validated = input
            .cart()
            .referral_validated()
            .and_then(|attr| attr.value())
            .map(|v| v == "true")
            .unwrap_or(false);

        if !referral_validated {
            // No referral validated, don't apply discount
            return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
        }

        // Check if referrer ID exists
        let referrer_id = input
            .cart()
            .referrer_customer_id()
            .and_then(|attr| attr.value());

        if referrer_id.is_none() {
            return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
        }

        // Get discount configuration from metafield
        let config: &DiscountConfig = match input.discount().metafield() {
            Some(metafield) => metafield.json_value(),
            None => {
                // No metafield configured, use defaults
                return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
            }
        };

        // Check if cart meets minimum order requirement
        if cart_subtotal < config.referee_min_order {
            // Cart doesn't meet minimum order requirement
            return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
        }

        // Apply order discount
        let discount_percentage = Decimal::from(config.referee_discount_percentage);

        let operations = vec![schema::CartOperation::OrderDiscountsAdd(
            schema::OrderDiscountsAddOperation {
                selection_strategy: schema::OrderDiscountSelectionStrategy::First,
                candidates: vec![schema::OrderDiscountCandidate {
                    targets: vec![schema::OrderDiscountCandidateTarget::OrderSubtotal(
                        schema::OrderSubtotalTarget {
                            excluded_cart_line_ids: vec![],
                        },
                    )],
                    message: Some(format!(
                        "Referral discount: {}% off",
                        config.referee_discount_percentage
                    )),
                    value: schema::OrderDiscountCandidateValue::Percentage(schema::Percentage {
                        value: discount_percentage,
                    }),
                    conditions: None,
                    associated_discount_code: None,
                }],
            },
        )];

        return Ok(schema::CartLinesDiscountsGenerateRunResult { operations });
    } else {
        // STORE CREDIT DISCOUNT LOGIC
        // Check if customer is logged in
        let customer = match input
            .cart()
            .buyer_identity()
            .and_then(|identity| identity.customer())
        {
            Some(c) => c,
            None => {
                // Customer not logged in, can't apply store credit
                return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
            }
        };

        // Get customer's referral credits from metafield
        let credits_str = match customer.metafield() {
            Some(m) => m.value().as_str(),
            None => "0",
        };

        let available_credits = credits_str.parse::<f64>().unwrap_or(0.0);

        // If no credits available, don't apply discount
        if available_credits <= 0.0 {
            return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
        }

        // Apply discount up to available credits or cart subtotal (whichever is less)
        let discount_amount = available_credits.min(cart_subtotal);

        if discount_amount <= 0.0 {
            return Ok(schema::CartLinesDiscountsGenerateRunResult { operations: vec![] });
        }

        // Convert to Decimal for the discount value
        let discount_decimal = Decimal::from(discount_amount);

        // Apply fixed amount discount
        let operations = vec![schema::CartOperation::OrderDiscountsAdd(
            schema::OrderDiscountsAddOperation {
                selection_strategy: schema::OrderDiscountSelectionStrategy::First,
                candidates: vec![schema::OrderDiscountCandidate {
                    targets: vec![schema::OrderDiscountCandidateTarget::OrderSubtotal(
                        schema::OrderSubtotalTarget {
                            excluded_cart_line_ids: vec![],
                        },
                    )],
                    message: Some(format!("Store credit: ${:.2}", discount_amount)),
                    value: schema::OrderDiscountCandidateValue::FixedAmount(
                        schema::FixedAmount {
                            amount: discount_decimal,
                        },
                    ),
                    conditions: None,
                    associated_discount_code: None,
                }],
            },
        )];

        return Ok(schema::CartLinesDiscountsGenerateRunResult { operations });
    }
}
