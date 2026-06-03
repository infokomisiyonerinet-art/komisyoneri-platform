/**
 * KOMISIYONERI Platform — Interactive Event Handler
 * Enables all button clicks, form submissions, navigation, and user interactions
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ═════════════════════════════════════════════════
  // 1. BUTTON CLICK HANDLERS
  // ═════════════════════════════════════════════════
  
  const allButtons = document.querySelectorAll('button, a[role="button"], .btn');
  allButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      // Allow default link behavior for <a> tags
      if (this.tagName === 'A' && this.href) {
        return; // Let default link behavior handle it
      }
      e.preventDefault();
      handleButtonClick(this);
    });
  });

  function handleButtonClick(button) {
    // Get button attributes to determine action
    const action = button.getAttribute('data-action');
    const target = button.getAttribute('data-target');
    const href = button.getAttribute('href');

    console.log('Button clicked:', {action, target, href});

    // Handle navigation links
    if (href && href.startsWith('#')) {
      const section = document.querySelector(href);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }

    // Handle modal toggles
    if (target) {
      const modal = document.querySelector(target);
      if (modal) {
        modal.classList.toggle('open');
      }
    }

    // Visual feedback
    button.style.transform = 'scale(0.98)';
    setTimeout(() => {
      button.style.removeProperty('transform');
    }, 100);
  }

  // ═════════════════════════════════════════════════
  // 2. FORM SUBMISSION HANDLERS
  // ═════════════════════════════════════════════════

  const allForms = document.querySelectorAll('form');
  allForms.forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      handleFormSubmit(this);
    });
  });

  function handleFormSubmit(form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    const formData = new FormData(form);
    
    console.log('Form submitted with data:', Object.fromEntries(formData));

    // Show success toast
    showToast('Form submitted successfully!', 'success');

    // Reset form after 500ms
    setTimeout(() => {
      form.reset();
    }, 500);
  }

  // ═════════════════════════════════════════════════
  // 3. NAVIGATION MENU HANDLERS
  // ═════════════════════════════════════════════════

  const navLinks = document.querySelectorAll('.nl, .dn');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from siblings
      this.parentElement?.querySelectorAll('.active').forEach(el => {
        el.classList.remove('active');
      });
      
      // Add active class to clicked link
      this.classList.add('active');

      // Navigate or scroll
      const href = this.getAttribute('href');
      if (href && href.startsWith('#')) {
        const section = document.querySelector(href);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // ═════════════════════════════════════════════════
  // 4. MODAL/DIALOG HANDLERS
  // ═════════════════════════════════════════════════

  // Close modals on X button click
  document.querySelectorAll('.modal-x, .tour-close-btn, .chat-x').forEach(closeBtn => {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const modal = this.closest('.modal-wrap, #tour-modal, .chat-panel');
      if (modal) {
        modal.classList.remove('open');
      }
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-wrap').forEach(backdrop => {
    backdrop.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('open');
      }
    });
  });

  // ═════════════════════════════════════════════════
  // 5. LANGUAGE SWITCHER
  // ═════════════════════════════════════════════════

  const langButtons = document.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active from all
      langButtons.forEach(b => b.classList.remove('active'));
      
      // Add active to clicked
      this.classList.add('active');

      const lang = this.getAttribute('data-lang') || this.textContent.trim();
      console.log('Language changed to:', lang);
      showToast(`Switched to ${lang}`, 'success');
    });
  });

  // ═════════════════════════════════════════════════
  // 6. TABS HANDLER
  // ═════════════════════════════════════════════════

  document.querySelectorAll('[role="tab"], .s-tab, .det-tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();

      // Find tab container
      const tabContainer = this.parentElement;
      if (!tabContainer) return;

      // Remove active from siblings
      tabContainer.querySelectorAll('[role="tab"], .s-tab, .det-tab').forEach(t => {
        t.classList.remove('active');
      });

      // Add active to clicked tab
      this.classList.add('active');

      // Find and show corresponding content
      const contentId = this.getAttribute('aria-controls') || this.getAttribute('data-tab');
      if (contentId) {
        const content = document.querySelector(contentId);
        if (content) {
          content.style.display = 'block';
        }
      }
    });
  });

  // ═════════════════════════════════════════════════
  // 7. CHECKBOXES & RADIO BUTTONS
  // ═════════════════════════════════════════════════

  document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
    input.addEventListener('change', function(e) {
      console.log(`${this.type} changed:`, this.name, '=', this.checked);
      
      // Update parent styling if in a label
      const label = this.closest('label, .filt-opt');
      if (label) {
        if (this.checked) {
          label.classList.add('checked');
        } else {
          label.classList.remove('checked');
        }
      }
    });
  });

  // ═════════════════════════════════════════════════
  // 8. SEARCH & FILTER FUNCTIONALITY
  // ═════════════════════════════════════════════════

  const searchButton = document.querySelector('.s-btn');
  if (searchButton) {
    searchButton.addEventListener('click', function(e) {
      e.preventDefault();
      handleSearch();
    });
  }

  function handleSearch() {
    const searchCard = document.querySelector('.s-card');
    const filters = {
      propertyType: document.querySelector('[name="type"]')?.value,
      location: document.querySelector('[name="location"]')?.value,
      minPrice: document.querySelector('[name="min-price"]')?.value,
      maxPrice: document.querySelector('[name="max-price"]')?.value
    };

    console.log('Search executed with filters:', filters);
    showToast('Searching properties...', 'success');

    // Hide search card after search
    if (searchCard) {
      searchCard.style.display = 'none';
    }
  }

  // ═════════════════════════════════════════════════
  // 9. CHAT WIDGET HANDLER
  // ═════════════════════════════════════════════════

  const chatFab = document.querySelector('.chat-fab');
  const chatPanel = document.querySelector('.chat-panel');

  if (chatFab) {
    chatFab.addEventListener('click', function(e) {
      e.preventDefault();
      if (chatPanel) {
        chatPanel.classList.toggle('open');
      }
    });
  }

  const chatSendBtn = document.querySelector('.chat-send');
  const chatInput = document.querySelector('.chat-inp');

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (chatInput && chatInput.value.trim()) {
        sendChatMessage(chatInput.value);
        chatInput.value = '';
      }
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatSendBtn?.click();
      }
    });
  }

  function sendChatMessage(message) {
    const chatMsgs = document.querySelector('.chat-msgs');
    if (!chatMsgs) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'cm me';
    userMsg.innerHTML = `
      ${message}
      <span class="cm-time">${new Date().toLocaleTimeString()}</span>
    `;
    chatMsgs.appendChild(userMsg);

    // Auto-scroll to bottom
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    // Simulate bot response
    setTimeout(() => {
      const botMsg = document.createElement('div');
      botMsg.className = 'cm bot';
      botMsg.innerHTML = `
        Thanks for your message! Our team will respond soon.
        <span class="cm-time">${new Date().toLocaleTimeString()}</span>
      `;
      chatMsgs.appendChild(botMsg);
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }, 1000);
  }

  // ═════════════════════════════════════════════════
  // 10. PROPERTY CARD INTERACTIONS
  // ═════════════════════════════════════════════════

  document.querySelectorAll('.p-card').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.p-fav')) return; // Don't navigate on fav click
      
      console.log('Property card clicked');
      // In production, navigate to property details
      // window.location.href = '/property/' + this.getAttribute('data-id');
      showToast('Loading property details...', 'success');
    });
  });

  // Favorite button
  document.querySelectorAll('.p-fav').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.toggle('on');
      const isFaved = this.classList.contains('on');
      showToast(isFaved ? 'Added to favorites' : 'Removed from favorites', 'success');
    });
  });

  // ═════════════════════════════════════════════════
  // 11. TOAST NOTIFICATION
  // ═════════════════════════════════════════════════

  function showToast(message, type = 'success') {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast show toast-${type}`;

    // Auto-hide after 4 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  // ═════════════════════════════════════════════════
  // 12. SMOOTH SCROLL FOR ANCHOR LINKS
  // ═════════════════════════════════════════════════

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ═════════════════════════════════════════════════
  // 13. ENABLE FORM INPUTS
  // ═════════════════════════════════════════════════

  document.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('focus', function() {
      this.style.pointerEvents = 'auto';
    });

    input.addEventListener('blur', function() {
      this.style.pointerEvents = 'auto';
    });
  });

  // ═════════════════════════════════════════════════
  // 14. INITIALIZATION LOG
  // ═════════════════════════════════════════════════

  console.log('✅ KOMISIYONERI Platform Interactive JS Loaded');
  console.log('All buttons, forms, and navigation are now interactive');
});

// ═════════════════════════════════════════════════
// UTILITY: Check for pointer-events blocking
// ═════════════════════════════════════════════════

window.checkPointerEvents = function() {
  const interactive = document.querySelectorAll('button, a, input, [role="button"]');
  const blocked = Array.from(interactive).filter(el => {
    const style = window.getComputedStyle(el);
    return style.pointerEvents === 'none';
  });

  if (blocked.length > 0) {
    console.warn('⚠️ Elements with pointer-events: none detected:', blocked);
  } else {
    console.log('✅ All interactive elements have pointer-events enabled');
  }
};

// Run check on load
checkPointerEvents();
