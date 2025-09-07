// Tangent Platform - Mobile Responsive JavaScript Helper
// Enhanced mobile experience and responsive behaviors

class TangentMobileResponsive {
  constructor() {
    this.isMobile = window.innerWidth <= 767;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth <= 1023;
    this.isDesktop = window.innerWidth >= 1024;
    this.touchDevice = 'ontouchstart' in window;
    
    this.init();
  }

  init() {
    this.setupMobileNavigation();
    this.setupResponsiveTables();
    this.setupTouchEnhancements();
    this.setupResizeHandler();
    this.setupModalEnhancements();
    this.setupFormEnhancements();
    this.setupScrollEnhancements();
    this.setupImageOptimization();
  }

  // Mobile Navigation
  setupMobileNavigation() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (mobileToggle && mobileMenu) {
      mobileToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        const isOpen = mobileMenu.classList.contains('active');
        
        // Update toggle icon
        mobileToggle.innerHTML = isOpen ? '✕' : '☰';
        
        // Prevent body scroll when menu is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-nav') && mobileMenu.classList.contains('active')) {
          mobileMenu.classList.remove('active');
          mobileToggle.innerHTML = '☰';
          document.body.style.overflow = '';
        }
      });

      // Close menu when window is resized to desktop
      window.addEventListener('resize', () => {
        if (window.innerWidth > 767) {
          mobileMenu.classList.remove('active');
          mobileToggle.innerHTML = '☰';
          document.body.style.overflow = '';
        }
      });
    }
  }

  // Responsive Tables
  setupResponsiveTables() {
    const tables = document.querySelectorAll('.table-responsive .table');
    
    tables.forEach(table => {
      const mobileContainer = this.createMobileTable(table);
      table.parentNode.appendChild(mobileContainer);
    });

    this.updateTableVisibility();
    window.addEventListener('resize', () => this.updateTableVisibility());
  }

  createMobileTable(table) {
    const mobileTable = document.createElement('div');
    mobileTable.className = 'table-mobile';
    
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const mobileItem = document.createElement('div');
      mobileItem.className = 'table-item';
      
      cells.forEach((cell, index) => {
        if (headers[index] && cell.textContent.trim()) {
          const itemRow = document.createElement('div');
          itemRow.className = 'table-item-row';
          
          const label = document.createElement('div');
          label.className = 'table-label';
          label.textContent = headers[index];
          
          const value = document.createElement('div');
          value.className = 'table-value';
          value.innerHTML = cell.innerHTML;
          
          itemRow.appendChild(label);
          itemRow.appendChild(value);
          mobileItem.appendChild(itemRow);
        }
      });
      
      mobileTable.appendChild(mobileItem);
    });
    
    return mobileTable;
  }

  updateTableVisibility() {
    const isMobile = window.innerWidth <= 767;
    
    document.querySelectorAll('.table-responsive .table').forEach(table => {
      table.style.display = isMobile ? 'none' : 'table';
    });
    
    document.querySelectorAll('.table-mobile').forEach(mobileTable => {
      mobileTable.style.display = isMobile ? 'block' : 'none';
    });
  }

  // Touch Enhancements
  setupTouchEnhancements() {
    if (!this.touchDevice) return;

    // Add touch feedback to interactive elements
    const interactiveElements = document.querySelectorAll('button, .btn, .card, .table-item');
    
    interactiveElements.forEach(element => {
      element.addEventListener('touchstart', () => {
        element.classList.add('touch-active');
      });
      
      element.addEventListener('touchend', () => {
        setTimeout(() => {
          element.classList.remove('touch-active');
        }, 150);
      });
    });

    // Add CSS for touch feedback
    if (!document.getElementById('touch-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'touch-feedback-styles';
      style.textContent = `
        .touch-active {
          opacity: 0.7;
          transform: scale(0.98);
          transition: all 0.1s ease;
        }
      `;
      document.head.appendChild(style);
    }

    // Swipe gestures for cards
    this.setupSwipeGestures();
  }

  setupSwipeGestures() {
    const swipeableCards = document.querySelectorAll('.trade-card, .card');
    
    swipeableCards.forEach(card => {
      let startX = 0;
      let startY = 0;
      let isScrolling = null;
      
      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isScrolling = null;
      });
      
      card.addEventListener('touchmove', (e) => {
        if (!startX || !startY) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        
        const diffX = startX - currentX;
        const diffY = startY - currentY;
        
        if (isScrolling === null) {
          isScrolling = Math.abs(diffX) < Math.abs(diffY);
        }
        
        if (!isScrolling && Math.abs(diffX) > 50) {
          // Add swipe indication
          card.style.transform = `translateX(${-diffX * 0.1}px)`;
        }
      });
      
      card.addEventListener('touchend', (e) => {
        if (!startX || !startY) return;
        
        const endX = e.changedTouches[0].clientX;
        const diffX = startX - endX;
        
        // Reset card position
        card.style.transform = '';
        
        if (Math.abs(diffX) > 100 && !isScrolling) {
          // Trigger swipe action
          const swipeEvent = new CustomEvent('swipe', {
            detail: { direction: diffX > 0 ? 'left' : 'right' }
          });
          card.dispatchEvent(swipeEvent);
        }
        
        startX = 0;
        startY = 0;
        isScrolling = null;
      });
    });
  }

  // Resize Handler
  setupResizeHandler() {
    let resizeTimer;
    
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.updateDeviceType();
        this.updateTableVisibility();
        this.adjustModalSizes();
        this.recalculateGridLayouts();
      }, 250);
    });
  }

  updateDeviceType() {
    this.isMobile = window.innerWidth <= 767;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth <= 1023;
    this.isDesktop = window.innerWidth >= 1024;
    
    // Update body class for CSS targeting
    document.body.className = document.body.className.replace(/device-\w+/g, '');
    
    if (this.isMobile) {
      document.body.classList.add('device-mobile');
    } else if (this.isTablet) {
      document.body.classList.add('device-tablet');
    } else {
      document.body.classList.add('device-desktop');
    }
  }

  // Modal Enhancements
  setupModalEnhancements() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
      // Make modals full-screen on mobile
      if (this.isMobile) {
        modal.classList.add('modal-mobile');
      }
      
      // Add swipe-down to close on mobile
      if (this.touchDevice) {
        this.setupModalSwipeClose(modal);
      }
    });
  }

  setupModalSwipeClose(modal) {
    let startY = 0;
    
    modal.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });
    
    modal.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY;
      
      if (diffY > 0 && diffY > 50) {
        modal.style.transform = `translateY(${diffY * 0.5}px)`;
        modal.style.opacity = Math.max(0.5, 1 - (diffY / 300));
      }
    });
    
    modal.addEventListener('touchend', (e) => {
      const endY = e.changedTouches[0].clientY;
      const diffY = endY - startY;
      
      if (diffY > 100) {
        // Close modal
        modal.style.transform = 'translateY(100%)';
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.style.display = 'none';
          modal.style.transform = '';
          modal.style.opacity = '';
        }, 300);
      } else {
        // Reset modal position
        modal.style.transform = '';
        modal.style.opacity = '';
      }
      
      startY = 0;
    });
  }

  adjustModalSizes() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        if (this.isMobile) {
          modalContent.style.maxHeight = 'calc(100vh - 2rem)';
          modalContent.style.margin = '1rem';
        } else {
          modalContent.style.maxHeight = '';
          modalContent.style.margin = '';
        }
      }
    });
  }

  // Form Enhancements
  setupFormEnhancements() {
    // Auto-focus first input on desktop
    if (this.isDesktop) {
      const firstInput = document.querySelector('.form-input, .form-select');
      if (firstInput) {
        firstInput.focus();
      }
    }

    // Improve form navigation on mobile
    const formInputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
    
    formInputs.forEach((input, index) => {
      // Add done/next buttons on mobile keyboard
      if (this.isMobile) {
        if (index === formInputs.length - 1) {
          input.setAttribute('enterkeyhint', 'done');
        } else {
          input.setAttribute('enterkeyhint', 'next');
        }
      }
      
      // Auto-advance to next field
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const nextInput = formInputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          } else {
            input.blur();
            // Submit form if it's the last input
            const form = input.closest('form');
            if (form) {
              form.submit();
            }
          }
        }
      });
    });

    // Improve select dropdowns on mobile
    const selects = document.querySelectorAll('.form-select');
    selects.forEach(select => {
      if (this.isMobile) {
        select.addEventListener('focus', () => {
          // Scroll element into view
          select.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    });
  }

  // Scroll Enhancements
  setupScrollEnhancements() {
    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Add scroll-to-top button on mobile
    if (this.isMobile) {
      this.createScrollToTopButton();
    }

    // Infinite scroll for tables/lists
    this.setupInfiniteScroll();
  }

  createScrollToTopButton() {
    const scrollButton = document.createElement('button');
    scrollButton.className = 'scroll-to-top';
    scrollButton.innerHTML = '↑';
    scrollButton.setAttribute('aria-label', 'Scroll to top');
    
    // Add styles
    Object.assign(scrollButton.style, {
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: '#667eea',
      color: 'white',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '1000',
      opacity: '0',
      visibility: 'hidden',
      transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(scrollButton);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollButton.style.opacity = '1';
        scrollButton.style.visibility = 'visible';
      } else {
        scrollButton.style.opacity = '0';
        scrollButton.style.visibility = 'hidden';
      }
    });
    
    // Scroll to top on click
    scrollButton.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  setupInfiniteScroll() {
    const scrollContainers = document.querySelectorAll('[data-infinite-scroll]');
    
    scrollContainers.forEach(container => {
      const loadMore = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          // Trigger load more event
          const loadMoreEvent = new CustomEvent('loadMore');
          container.dispatchEvent(loadMoreEvent);
        }
      };
      
      container.addEventListener('scroll', loadMore);
    });
  }

  // Image Optimization
  setupImageOptimization() {
    // Lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });
      
      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for older browsers
      images.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }

    // Responsive images based on device
    this.optimizeImagesForDevice();
  }

  optimizeImagesForDevice() {
    const images = document.querySelectorAll('img[data-mobile-src], img[data-tablet-src]');
    
    images.forEach(img => {
      let newSrc = img.src;
      
      if (this.isMobile && img.dataset.mobileSrc) {
        newSrc = img.dataset.mobileSrc;
      } else if (this.isTablet && img.dataset.tabletSrc) {
        newSrc = img.dataset.tabletSrc;
      }
      
      if (newSrc !== img.src) {
        img.src = newSrc;
      }
    });
  }

  recalculateGridLayouts() {
    // Recalculate any CSS Grid or Flexbox layouts that need adjustment
    const gridContainers = document.querySelectorAll('[data-responsive-grid]');
    
    gridContainers.forEach(container => {
      if (this.isMobile) {
        container.style.gridTemplateColumns = '1fr';
      } else if (this.isTablet) {
        container.style.gridTemplateColumns = 'repeat(2, 1fr)';
      } else {
        container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
      }
    });
  }

  // Utility Methods
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Position based on device
    if (this.isMobile) {
      notification.style.left = '1rem';
      notification.style.right = '1rem';
      notification.style.top = '1rem';
    } else {
      notification.style.right = '1rem';
      notification.style.top = '1rem';
    }
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto hide
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  vibrate(pattern = [100]) {
    if ('vibrate' in navigator && this.touchDevice) {
      navigator.vibrate(pattern);
    }
  }

  // Device Detection Utilities
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  // Performance Optimization
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.tangentMobile = new TangentMobileResponsive();
});

// Export for manual initialization
window.TangentMobileResponsive = TangentMobileResponsive;



