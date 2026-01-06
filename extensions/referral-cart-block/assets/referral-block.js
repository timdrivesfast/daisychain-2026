/**
 * Daisychain Referral Widget JavaScript
 * 
 * Handles:
 * 1. Modal open/close
 * 2. Referrer name validation via app proxy
 * 3. Cart attribute updates via app proxy (which calls Storefront API)
 */

(function() {
  'use strict';

  // Prevent duplicate widgets - only allow one instance on the page
  const existingWidgets = document.querySelectorAll('.daisychain-referral-widget');
  if (existingWidgets.length > 1) {
    // Keep only the first one, hide/remove the rest
    for (let i = 1; i < existingWidgets.length; i++) {
      existingWidgets[i].style.display = 'none';
    }
  }

  // Get the widget element
  const widget = document.getElementById('daisychain-referral-widget');
  if (!widget) return;

  // Get cart token from data attribute or fetch it
  let cartToken = widget.getAttribute('data-cart-token');
  
  // If no cart token, try to get it from Shopify object or fetch cart
  if (!cartToken && window.Shopify?.theme?.cart?.token) {
    cartToken = window.Shopify.theme.cart.token;
  }

  // Get DOM elements
  const triggerBtn = document.getElementById('referral-trigger-btn');
  const modalOverlay = document.getElementById('referral-modal-overlay');
  const modalClose = document.getElementById('referral-modal-close');
  const step1 = document.getElementById('referral-step-1');
  const step2 = document.getElementById('referral-step-2');
  const step2_5 = document.getElementById('referral-step-2-5');
  const step3 = document.getElementById('referral-step-3');
  const step4 = document.getElementById('referral-step-4');
  const yesBtn = document.getElementById('referral-yes-btn');
  const noBtn = document.getElementById('referral-no-btn');
  const backBtn = document.getElementById('referral-back-btn');
  const backBtnDup = document.getElementById('referral-back-btn-dup');
  const backBtnStep3 = document.getElementById('referral-back-btn-step3');
  const continueShoppingBtn = document.getElementById('continue-shopping-btn');
  const input = document.getElementById('referrer-name-input');
  const validateBtn = document.getElementById('validate-referrer-btn');
  const message = document.getElementById('referral-message');
  const successMessage = document.getElementById('referral-success-message');
  const checkReferrerInput = document.getElementById('check-referrer-name-input');
  const checkReferrerBtn = document.getElementById('check-referrer-btn');
  const referrerStatusMessage = document.getElementById('referrer-status-message');
  const duplicatesList = document.getElementById('referral-duplicates-list');

  if (!triggerBtn || !modalOverlay || !modalClose || !step1 || !step2 || !step2_5 || !step3 || !step4 || !yesBtn || !noBtn || !continueShoppingBtn || !input || !validateBtn || !message || !successMessage || !checkReferrerInput || !checkReferrerBtn || !referrerStatusMessage || !backBtnDup || !duplicatesList) return;

  // Get shop domain from current URL
  const shopDomain = window.Shopify?.shop || window.location.hostname;
  const appProxyUrl = `https://${shopDomain}/apps/daisychain/lookup-referrer`;
  const configUrl = `https://${shopDomain}/apps/daisychain/config`;
  const checkReferrerStatusUrl = `https://${shopDomain}/apps/daisychain/check-referrer-status`;
  
  // Store config for use in encouragement message and trigger button
  let referrerCreditAmount = 5.0; // Default
  let discountPercentage = 10; // Default
  let widgetColors = {
    primary: "#ff6b6b",
    secondary: "#ee5a6f",
    success: "#4caf50",
    text: "#ffffff",
  };
  
  // Track if referral has been validated
  let isReferralValidated = false;
  let validatedReferrerName = '';

  // Typewriter effect for example names
  let typewriterInterval = null;
  let typewriterTimeout = null;
  const exampleNames = [
    'Sarah Johnson',
    'Michael Chen',
    'Emma Williams',
    'David Martinez',
    'Jessica Brown',
    'James Taylor'
  ];
  let currentExampleIndex = 0;
  let isTyping = false;
  let isDeleting = false;

  /**
   * Typewriter effect - cycles through example names
   * Works like animated placeholder text - continues even when focused
   */
  function startTypewriterEffect() {
    // Clear any existing typewriter
    stopTypewriterEffect();
    
    // Only start if input is empty
    if (input.value.trim() !== '') {
      return;
    }

    // Reset to first name when starting
    currentExampleIndex = 0;
    let currentName = exampleNames[currentExampleIndex];
    let currentText = '';
    let charIndex = 0;
    isTyping = true;
    isDeleting = false;

    function typeNextChar() {
      // Stop if user has typed something
      if (input.value.trim() !== '' && input.value !== currentText) {
        return;
      }

      if (isDeleting) {
        // Delete one character
        if (currentText.length > 0) {
          currentText = currentText.slice(0, -1);
          input.value = currentText;
          typewriterTimeout = setTimeout(typeNextChar, 50); // Fast delete
        } else {
          // Finished deleting, move to next name
          isDeleting = false;
          currentExampleIndex = (currentExampleIndex + 1) % exampleNames.length;
          currentName = exampleNames[currentExampleIndex];
          charIndex = 0;
          // Wait a bit before typing next name
          typewriterTimeout = setTimeout(typeNextChar, 800);
        }
      } else {
        // Type one character
        if (charIndex < currentName.length) {
          currentText += currentName[charIndex];
          input.value = currentText;
          charIndex++;
          typewriterTimeout = setTimeout(typeNextChar, 100); // Typing speed
        } else {
          // Finished typing, wait then start deleting
          isDeleting = true;
          typewriterTimeout = setTimeout(typeNextChar, 2000); // Pause before deleting
        }
      }
    }

    // Start typing
    typeNextChar();
  }

  /**
   * Stop typewriter effect
   */
  function stopTypewriterEffect() {
    if (typewriterTimeout) {
      clearTimeout(typewriterTimeout);
      typewriterTimeout = null;
    }
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
    isTyping = false;
    isDeleting = false;
  }

  /**
   * Fetch discount config from admin
   */
  async function loadConfig() {
    try {
      const response = await fetch(`${configUrl}?shop=${shopDomain}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.referrer_credit_amount !== undefined) {
          referrerCreditAmount = data.referrer_credit_amount;
        }
        if (data.discount_percentage !== undefined) {
          discountPercentage = data.discount_percentage;
        }
        // Update widget colors
        if (data.widget_primary_color) widgetColors.primary = data.widget_primary_color;
        if (data.widget_secondary_color) widgetColors.secondary = data.widget_secondary_color;
        if (data.widget_success_color) widgetColors.success = data.widget_success_color;
        if (data.widget_text_color) widgetColors.text = data.widget_text_color;
        
        // Apply colors to widget
        applyWidgetColors();
        
        // Update UI with actual values
        updateEncouragementText();
        updateTriggerButtonText();
        updateOfferBadge();
      }
    } catch (error) {
      console.warn('Daisychain: Could not fetch discount config, using default', error);
      // Still update with defaults
      updateTriggerButtonText();
      updateOfferBadge();
    }
  }

  /**
   * Update encouragement text with current credit amount
   */
  function updateEncouragementText() {
    const encouragementText = document.querySelector('#referral-step-3 .referral-modal-description');
    const creditAmountElement = document.querySelector('#referral-step-3 .credit-amount');
    
    if (encouragementText) {
      encouragementText.textContent = `Make a purchase to become a referrer and get $${referrerCreditAmount.toFixed(2)} for each successful referral!`;
    }
    
    if (creditAmountElement) {
      creditAmountElement.textContent = `$${referrerCreditAmount.toFixed(2)}`;
    }
  }

  /**
   * Update trigger button text with discount percentage
   * Only updates if not in validated state (showing checkmark)
   */
  function updateTriggerButtonText() {
    // Don't update if already validated (showing checkmark)
    if (triggerBtn?.classList.contains('referral-validated')) {
      return;
    }
    
    const triggerText = triggerBtn?.querySelector('.referral-trigger-text');
    if (triggerText) {
      triggerText.textContent = `Get ${discountPercentage}% Off`;
    }
  }

  /**
   * Update offer badge text with discount percentage
   */
  function updateOfferBadge() {
    const offerBadge = document.getElementById('referral-offer-badge');
    if (offerBadge) {
      offerBadge.textContent = `Get ${discountPercentage}% Off`;
    }
  }

  /**
   * Apply widget colors via CSS variables
   */
  function applyWidgetColors() {
    const root = document.documentElement;
    root.style.setProperty('--widget-primary-color', widgetColors.primary);
    root.style.setProperty('--widget-secondary-color', widgetColors.secondary);
    root.style.setProperty('--widget-success-color', widgetColors.success);
    root.style.setProperty('--widget-text-color', widgetColors.text);
    
    // Also apply directly to widget element for better compatibility
    if (widget) {
      widget.style.setProperty('--widget-primary-color', widgetColors.primary);
      widget.style.setProperty('--widget-secondary-color', widgetColors.secondary);
      widget.style.setProperty('--widget-success-color', widgetColors.success);
      widget.style.setProperty('--widget-text-color', widgetColors.text);
    }
  }

  // Apply default colors immediately
  applyWidgetColors();
  
  // Update trigger button and badge with default value immediately
  updateTriggerButtonText();
  updateOfferBadge();
  
  // Load config when widget initializes (will update trigger button, badge, and colors with actual values)
  loadConfig();
  
  // Check if referral is already validated on page load
  checkReferralStatus();

  /**
   * Check if referral has been validated by checking localStorage and cart attributes
   * Uses localStorage as primary source (works on dev stores) with cart as fallback
   */
  async function checkReferralStatus() {
    // First check localStorage (works on dev stores where cart updates are simulated)
    const storedValidation = localStorage.getItem('daisychain_referral_validated');
    const storedReferrerName = localStorage.getItem('daisychain_referrer_name');
    
    if (storedValidation === 'true' && storedReferrerName) {
      isReferralValidated = true;
      validatedReferrerName = storedReferrerName;
      updateTriggerToCheckmark();
      return;
    }
    
    // Fallback: Check cart attributes (for production stores)
    try {
      // Fetch cart to check for referral_validated attribute
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      if (cart.attributes && cart.attributes.referral_validated === 'true') {
        isReferralValidated = true;
        validatedReferrerName = cart.attributes.referrer_name || '';
        
        // Also save to localStorage for consistency
        localStorage.setItem('daisychain_referral_validated', 'true');
        if (validatedReferrerName) {
          localStorage.setItem('daisychain_referrer_name', validatedReferrerName);
        }
        
        updateTriggerToCheckmark();
      }
    } catch (error) {
      console.warn('Daisychain: Could not check referral status', error);
    }
  }

  /**
   * Update trigger button to show checkmark when validated
   */
  function updateTriggerToCheckmark() {
    if (triggerBtn) {
      triggerBtn.classList.add('referral-validated');
      const triggerText = triggerBtn.querySelector('.referral-trigger-text');
      if (triggerText) {
        triggerText.textContent = '✓';
        // Hide the gift emoji by removing the ::after pseudo-element content
        triggerText.classList.add('no-emoji');
      }
    }
  }

  /**
   * Open modal (show step 1 or step 4 if already validated)
   */
  function openModal() {
    // Move modal to body to escape widget container's transform
    if (modalOverlay.parentElement !== document.body) {
      document.body.appendChild(modalOverlay);
    }
    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // If referral is already validated, show celebration step
    if (isReferralValidated) {
      step1.style.display = 'none';
      step2.style.display = 'none';
      step2_5.style.display = 'none';
      step3.style.display = 'none';
      step4.style.display = 'block';
      
      // Update success message with referrer name
      if (validatedReferrerName) {
        successMessage.textContent = `You'll get a discount thanks to ${validatedReferrerName}!`;
      } else {
        successMessage.textContent = 'You\'ll get a discount thanks to your referrer!';
      }
      
      // Trigger confetti animation
      triggerConfetti();
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
      return;
    }
    
    // Show step 1, hide others (normal flow)
    step1.style.display = 'block';
    step2.style.display = 'none';
    step2_5.style.display = 'none';
    step3.style.display = 'none';
    step4.style.display = 'none';
    // Reset form
    input.value = '';
    input.disabled = false;
    validateBtn.disabled = false;
    validateBtn.textContent = 'Submit';
    hideMessage();
    // Stop any typewriter effect
    stopTypewriterEffect();
  }

  /**
   * Close modal
   */
  function closeModal() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
    hideMessage();
    // Stop typewriter effect
    stopTypewriterEffect();
    // Move modal back to widget container when closed
    if (widget && modalOverlay.parentElement === document.body) {
      widget.appendChild(modalOverlay);
    }
  }

  /**
   * Show step 2 (name input)
   */
  function showNameInput() {
    step1.style.display = 'none';
    step2.style.display = 'block';
    step2_5.style.display = 'none';
    step3.style.display = 'none';
    step4.style.display = 'none';
    // Clear input and start typewriter effect
    input.value = '';
    // Start typewriter after a short delay to let the animation finish
    setTimeout(() => {
      startTypewriterEffect();
    }, 300);
  }

  /**
   * Show step 3 (encouragement)
   */
  function showEncouragement() {
    step1.style.display = 'none';
    step2.style.display = 'none';
    step2_5.style.display = 'none';
    step3.style.display = 'block';
    // Update encouragement text with current credit amount
    updateEncouragementText();
    
    // Reset visibility of elements in case they were hidden from a previous check
    const benefitsSection = document.querySelector('.referral-benefits');
    const description = document.querySelector('.referral-modal-description');
    const checkReferrerText = document.querySelector('.referral-check-referrer-text');
    const checkReferrerForm = document.querySelector('.referral-check-referrer-form');
    
    if (benefitsSection) benefitsSection.style.display = 'flex';
    if (description) description.style.display = 'block';
    if (checkReferrerText) checkReferrerText.style.display = 'block';
    if (checkReferrerForm) checkReferrerForm.style.display = 'flex';
    
    // Clear any previous status messages
    hideReferrerStatusMessage();
    checkReferrerInput.value = '';
  }

  /**
   * Show message to user
   */
  function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = `referral-message ${isError ? 'error' : 'success'}`;
    message.style.display = 'block';
    
    // Remove any action button if it exists
    const existingActionBtn = message.querySelector('.referral-message-action-btn');
    if (existingActionBtn) {
      existingActionBtn.remove();
    }
    
    // Auto-hide success messages after 5 seconds
    if (!isError) {
      setTimeout(() => {
        message.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Show message with an action button
   */
  function showMessageWithAction(text, isError = false, actionText = '', actionCallback = null) {
    message.textContent = text;
    message.className = `referral-message ${isError ? 'error' : 'success'}`;
    message.style.display = 'block';
    
    // Remove any existing action button
    const existingActionBtn = message.querySelector('.referral-message-action-btn');
    if (existingActionBtn) {
      existingActionBtn.remove();
    }
    
    // Add action button if provided
    if (actionText && actionCallback) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'referral-message-action-btn';
      actionBtn.textContent = actionText;
      actionBtn.type = 'button';
      actionBtn.style.cssText = `
        margin-top: 12px;
        padding: 8px 16px;
        background-color: ${isError ? '#FB3F46' : '#4caf50'};
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: background-color 0.2s ease;
      `;
      actionBtn.addEventListener('mouseenter', () => {
        actionBtn.style.backgroundColor = isError ? '#e02e35' : '#45a049';
      });
      actionBtn.addEventListener('mouseleave', () => {
        actionBtn.style.backgroundColor = isError ? '#FB3F46' : '#4caf50';
      });
      actionBtn.addEventListener('click', () => {
        actionCallback();
        message.style.display = 'none';
      });
      message.appendChild(actionBtn);
    }
    
    // Auto-hide success messages after 5 seconds
    if (!isError) {
      setTimeout(() => {
        message.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Hide message
   */
  function hideMessage() {
    message.style.display = 'none';
  }

  /**
   * Get cart token (async if needed)
   */
  async function getCartToken() {
    if (cartToken) return cartToken;

    // Try to fetch cart token from Shopify Cart API
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      if (cart.token) {
        cartToken = cart.token;
        return cartToken;
      }
    } catch (error) {
      console.warn('Daisychain: Could not fetch cart token', error);
    }

    return null;
  }

  /**
   * Show duplicate selection step when multiple customers match the name
   */
  function showDuplicateSelection(customers, referrerName) {
    // Clear previous duplicates
    duplicatesList.innerHTML = '';
    
    // Create option buttons for each duplicate
    customers.forEach((customer, index) => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'referral-duplicate-option';
      optionDiv.innerHTML = `
        <div class="referral-duplicate-info">
          <div class="referral-duplicate-name">${customer.displayName}</div>
          <div class="referral-duplicate-email">${customer.anonymizedEmail}</div>
        </div>
      `;
      
      // Add click handler to select this customer
      optionDiv.addEventListener('click', () => {
        selectDuplicateCustomer(customer);
      });
      
      duplicatesList.appendChild(optionDiv);
    });
    
    // Hide step 2, show step 2.5
    step2.style.display = 'none';
    step2_5.style.display = 'block';
    step3.style.display = 'none';
    step4.style.display = 'none';
  }

  /**
   * Handle selection of a duplicate customer
   */
  async function selectDuplicateCustomer(customer) {
    // Disable all options during processing
    const options = duplicatesList.querySelectorAll('.referral-duplicate-option');
    options.forEach(opt => {
      opt.style.pointerEvents = 'none';
      opt.style.opacity = '0.6';
    });

    try {
      // Update cart with selected customer
      const cartUpdateResponse = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attributes: {
            referral_validated: 'true',
            referrer_customer_id: customer.id,
            referrer_name: customer.displayName,
          },
        }),
      });

      if (!cartUpdateResponse.ok) {
        throw new Error('Cart update failed');
      }

      const cartData = await cartUpdateResponse.json();
      console.log('Daisychain: Cart attributes updated successfully for duplicate', cartData);
      
      // Verify attributes were set
      const verifyCart = await fetch('/cart.js');
      const verifiedCart = await verifyCart.json();
      
      if (!verifiedCart.attributes || verifiedCart.attributes.referral_validated !== 'true') {
        console.error('Daisychain: Cart attributes verification failed!', verifiedCart.attributes);
        showMessage('Failed to verify cart attributes. Please try again.', true);
        // Re-enable options
        options.forEach(opt => {
          opt.style.pointerEvents = 'auto';
          opt.style.opacity = '1';
        });
        return;
      }
      
      console.log('Daisychain: ✅ Cart attributes verified for duplicate:', {
        referral_validated: verifiedCart.attributes.referral_validated,
        referrer_customer_id: verifiedCart.attributes.referrer_customer_id,
      });

      // Success! Mark as validated and show celebration
      isReferralValidated = true;
      validatedReferrerName = customer.displayName;
      
      // Save to localStorage
      localStorage.setItem('daisychain_referral_validated', 'true');
      localStorage.setItem('daisychain_referrer_name', validatedReferrerName);
      
      // Hide step 2.5, show celebration step
      step2_5.style.display = 'none';
      step4.style.display = 'block';
      
      // Update success message with referrer name
      successMessage.textContent = `You'll get a discount thanks to ${customer.displayName}!`;
      
      // Update trigger button to checkmark
      updateTriggerToCheckmark();
      
      // Trigger confetti animation
      triggerConfetti();
      
      // Close modal after celebration (2.5 seconds)
      setTimeout(() => {
        closeModal();
        // Reload page to show discount and update trigger button
        window.location.reload();
      }, 2500);

    } catch (error) {
      console.error('Daisychain referral error (duplicate selection):', error);
      showMessage('An error occurred. Please try again.', true);
      // Re-enable options
      options.forEach(opt => {
        opt.style.pointerEvents = 'auto';
        opt.style.opacity = '1';
      });
    }
  }

  /**
   * Validate referrer name and update cart attributes
   */
  async function validateAndSetReferrer() {
    const referrerName = input.value.trim();
    
    if (!referrerName) {
      showMessage('Please enter a referrer name', true);
      return;
    }

    // Disable button during request
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    hideMessage();

    try {
      // Step 1: Validate referrer via app proxy
      const lookupUrl = `${appProxyUrl}?name=${encodeURIComponent(referrerName)}`;
      const lookupResponse = await fetch(lookupUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const lookupData = await lookupResponse.json();
      
      if (!lookupResponse.ok) {
        // Show the specific error message from the server
        showMessage(lookupData.error || 'Failed to validate referrer. Please try again.', true);
        validateBtn.disabled = false;
        validateBtn.textContent = 'Submit';
        return;
      }
      
      // Check for duplicates (multiple customers with same name)
      if (lookupData.duplicates && lookupData.customers && lookupData.customers.length > 1) {
        // Show duplicate selection step
        showDuplicateSelection(lookupData.customers, referrerName);
        validateBtn.disabled = false;
        validateBtn.textContent = 'Submit';
        return;
      }
      
      if (!lookupData.success || !lookupData.customer) {
        showMessageWithAction(
          'That person wasn\'t a referrer. Try again or sign up to be a referrer!',
          true,
          'Sign up to be a referrer',
          () => {
            showEncouragement();
          }
        );
        validateBtn.disabled = false;
        validateBtn.textContent = 'Submit';
        return;
      }

      // Step 2: Update Online Store cart attributes using AJAX Cart API
      // This sets attributes on the Online Store cart (not Storefront API cart)
      // The discount function reads from the Online Store cart at checkout
      try {
        const cartUpdateResponse = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attributes: {
              referral_validated: 'true',
              referrer_customer_id: lookupData.customer.id,
              referrer_name: lookupData.customer.displayName,
            },
          }),
        });

        if (!cartUpdateResponse.ok) {
          throw new Error('Cart update failed');
        }

        const cartData = await cartUpdateResponse.json();
        console.log('Daisychain: Cart attributes updated successfully', cartData);
        
        // Verify attributes were set
        if (cartData.attributes) {
          console.log('Daisychain: Cart attributes after update:', {
            referral_validated: cartData.attributes.referral_validated,
            referrer_customer_id: cartData.attributes.referrer_customer_id,
            referrer_name: cartData.attributes.referrer_name,
          });
        } else {
          console.warn('Daisychain: Cart response does not include attributes object');
        }

        // CRITICAL: Verify attributes are actually present before proceeding
        // This prevents timing issues where checkout loads before attributes are set
        const verifyCart = await fetch('/cart.js');
        const verifiedCart = await verifyCart.json();
        
        if (!verifiedCart.attributes || verifiedCart.attributes.referral_validated !== 'true') {
          console.error('Daisychain: Cart attributes verification failed!', verifiedCart.attributes);
          showMessage('Failed to verify cart attributes. Please try again.', true);
          validateBtn.disabled = false;
          validateBtn.textContent = 'Submit';
          return;
        }
        
        console.log('Daisychain: ✅ Cart attributes verified before proceeding:', {
          referral_validated: verifiedCart.attributes.referral_validated,
          referrer_customer_id: verifiedCart.attributes.referrer_customer_id,
        });
      } catch (cartError) {
        console.error('Daisychain: Failed to update cart attributes', cartError);
        showMessage('Failed to apply referral to cart. Please try again.', true);
        validateBtn.disabled = false;
        validateBtn.textContent = 'Submit';
        return;
      }

      // Success! Mark as validated and show celebration
      isReferralValidated = true;
      validatedReferrerName = lookupData.customer.displayName;
      
      // Save to localStorage (works on dev stores where cart updates are simulated)
      localStorage.setItem('daisychain_referral_validated', 'true');
      localStorage.setItem('daisychain_referrer_name', validatedReferrerName);
      
      input.disabled = true;
      validateBtn.disabled = true;
      validateBtn.textContent = 'Applied ✓';
      
      // Hide step 2, show celebration step
      step2.style.display = 'none';
      step4.style.display = 'block';
      
      // Update success message with referrer name
      successMessage.textContent = `You'll get a discount thanks to ${lookupData.customer.displayName}!`;
      
      // Update trigger button to checkmark
      updateTriggerToCheckmark();
      
      // Trigger confetti animation
      triggerConfetti();
      
      // Close modal after celebration (2.5 seconds)
      setTimeout(() => {
        closeModal();
        // Reload page to show discount and update trigger button
        window.location.reload();
      }, 2500);

    } catch (error) {
      console.error('Daisychain referral error:', error);
      showMessage('An error occurred. Please try again.', true);
      validateBtn.disabled = false;
      validateBtn.textContent = 'Submit';
    }
  }

  // Event listeners
  triggerBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  yesBtn.addEventListener('click', showNameInput);
  noBtn.addEventListener('click', showEncouragement);
  // Back button for step 2 (goes back to step 1)
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      step1.style.display = 'block';
      step2.style.display = 'none';
      step2_5.style.display = 'none';
      step3.style.display = 'none';
      step4.style.display = 'none';
      hideMessage();
      // Stop typewriter when going back
      stopTypewriterEffect();
    });
  }

  // Back button for step 3 (goes back to step 1)
  if (backBtnStep3) {
    backBtnStep3.addEventListener('click', () => {
      step1.style.display = 'block';
      step2.style.display = 'none';
      step2_5.style.display = 'none';
      step3.style.display = 'none';
      step4.style.display = 'none';
      hideMessage();
    });
  }

  // Back button for step 2.5 (duplicate selection - goes back to step 2)
  if (backBtnDup) {
    backBtnDup.addEventListener('click', () => {
      step2.style.display = 'block';
      step2_5.style.display = 'none';
      step3.style.display = 'none';
      step4.style.display = 'none';
      hideMessage();
      // Clear duplicates list
      duplicatesList.innerHTML = '';
      // Re-enable input and button
      input.disabled = false;
      validateBtn.disabled = false;
      validateBtn.textContent = 'Submit';
    });
  }

  /**
   * Trigger confetti animation
   */
  function triggerConfetti() {
    const confettiElements = document.querySelectorAll('.confetti');
    confettiElements.forEach((confetti, index) => {
      confetti.style.animation = 'none';
      // Force reflow
      void confetti.offsetWidth;
      confetti.style.animation = `confettiFall ${0.8 + index * 0.1}s ease-out forwards`;
    });
  }
  continueShoppingBtn.addEventListener('click', closeModal);

  /**
   * Check if user is already a referrer
   */
  async function checkReferrerStatus() {
    const customerName = checkReferrerInput.value.trim();
    
    if (!customerName) {
      showReferrerStatusMessage('Please enter your full name', true);
      return;
    }

    checkReferrerBtn.disabled = true;
    checkReferrerBtn.textContent = 'Checking...';
    hideReferrerStatusMessage();

    try {
      const response = await fetch(`${checkReferrerStatusUrl}?name=${encodeURIComponent(customerName)}&shop=${shopDomain}`);
      const data = await response.json();

      if (data.error) {
        if (data.error === 'customer_not_found') {
          showReferrerStatusMessage('Customer not found. Make sure you\'ve made a purchase and entered your name correctly.', true);
        } else {
          showReferrerStatusMessage(data.message || 'An error occurred. Please try again.', true);
        }
        checkReferrerBtn.disabled = false;
        checkReferrerBtn.textContent = 'Check Status';
        return;
      }

      if (data.success) {
        if (data.is_eligible) {
          // Hide the benefits section and description when they're already eligible
          const benefitsSection = document.querySelector('.referral-benefits');
          const description = document.querySelector('.referral-modal-description');
          const checkReferrerText = document.querySelector('.referral-check-referrer-text');
          const checkReferrerForm = document.querySelector('.referral-check-referrer-form');
          
          if (benefitsSection) benefitsSection.style.display = 'none';
          if (description) description.style.display = 'none';
          if (checkReferrerText) checkReferrerText.style.display = 'none';
          if (checkReferrerForm) checkReferrerForm.style.display = 'none';
          
          showReferrerStatusMessage(
            `🎉 Great news! You're already eligible to refer others! You've made ${data.number_of_orders} purchase${data.number_of_orders !== 1 ? 's' : ''}. Just tell people to use your first and last name when they shop!`,
            false
          );
        } else {
          showReferrerStatusMessage(
            `You've made ${data.number_of_orders} purchase${data.number_of_orders !== 1 ? 's' : ''}, but you need at least ${data.min_required_orders} purchase${data.min_required_orders !== 1 ? 's' : ''} to be eligible. Make ${data.min_required_orders - data.number_of_orders} more purchase${data.min_required_orders - data.number_of_orders !== 1 ? 's' : ''} to start referring!`,
            true
          );
        }
        checkReferrerBtn.disabled = false;
        checkReferrerBtn.textContent = 'Check Status';
      }
    } catch (error) {
      console.error('Error checking referrer status:', error);
      showReferrerStatusMessage('Unable to check status. Please try again later.', true);
      checkReferrerBtn.disabled = false;
      checkReferrerBtn.textContent = 'Check Status';
    }
  }

  /**
   * Show referrer status message
   */
  function showReferrerStatusMessage(text, isError = false) {
    referrerStatusMessage.textContent = text;
    referrerStatusMessage.className = `referral-message ${isError ? 'error' : 'success'}`;
    referrerStatusMessage.style.display = 'block';
  }

  /**
   * Hide referrer status message
   */
  function hideReferrerStatusMessage() {
    referrerStatusMessage.style.display = 'none';
  }

  // Check referrer status button
  checkReferrerBtn.addEventListener('click', checkReferrerStatus);

  // Handle Enter key in check referrer input
  checkReferrerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkReferrerStatus();
    }
  });
  
  // Close modal when clicking outside
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.style.display !== 'none') {
      closeModal();
    }
  });

  // Validate button
  validateBtn.addEventListener('click', validateAndSetReferrer);

  // Handle Enter key in input
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateAndSetReferrer();
    }
  });

  // Clear input and stop typewriter when user focuses - use real placeholder
  input.addEventListener('focus', () => {
    // Stop typewriter immediately
    stopTypewriterEffect();
    // Always clear the input value on focus so placeholder shows properly
    // This ensures user starts typing from the beginning
    input.value = '';
  });
  
  // Stop typewriter when input loses focus if empty (so it can restart when not focused)
  input.addEventListener('blur', () => {
    // Only restart typewriter if input is empty and not focused
    if (input.value.trim() === '') {
      // Small delay before restarting so placeholder can show
      setTimeout(() => {
        if (document.activeElement !== input && input.value.trim() === '') {
          startTypewriterEffect();
        }
      }, 500);
    }
  });

  input.addEventListener('input', () => {
    // Stop typewriter when user types
    stopTypewriterEffect();
    // Clear message when user starts typing
    if (message.style.display !== 'none') {
      hideMessage();
    }
  });

  // Stop typewriter when user clicks in the input
  input.addEventListener('click', () => {
    stopTypewriterEffect();
  });
})();
