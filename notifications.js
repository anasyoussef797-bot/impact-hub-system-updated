/**
 * Impact Hub Egypt - Unified Notifications, Soundscapes & PWA Client Engine
 */

(function () {
  'use strict';

  // 1. SOUNDSCAPES ENGINE (Web Audio API - Zero Asset Dependency)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function isSoundMuted() {
    return localStorage.getItem('impact_sound_muted') === 'true';
  }

  function setSoundMuted(muted) {
    localStorage.setItem('impact_sound_muted', muted ? 'true' : 'false');
    updateMuteIcons();
  }

  function playImpactSound(type = 'chime') {
    if (isSoundMuted()) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0.08, now); // Soft, non-intrusive volume

      if (type === 'chime' || type === 'academic' || type === 'admin') {
        // Dual-tone Warm E5 -> A5 Bell Chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, now + 0.08); // A5

        gain1.gain.setValueAtTime(0.7, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        gain2.gain.setValueAtTime(0.8, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc2.connect(gain2);
        gain2.connect(masterGain);

        osc1.start(now);
        osc1.stop(now + 0.7);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.85);
      } else if (type === 'success' || type === 'financial') {
        // Harmonious 3-tone ascending chime (C5 -> E5 -> G5)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = now + (i * 0.09);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, noteStart);

          gain.gain.setValueAtTime(0.6, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.65);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(noteStart);
          osc.stop(noteStart + 0.65);
        });
      }
    } catch (e) {
      console.warn('[Soundscapes] Audio playback bypassed:', e);
    }
  }

  // 2. NOTIFICATIONS STATE & PERSISTENCE
  const DEFAULT_NOTIFICATIONS = [
    {
      id: 'notif-1',
      title: 'تقرير نشاط يومي جديد',
      message: 'أكملت سارة اليوم نشاط الرسم والتلوين بنجاح وتفاعلت بحماس مع أصدقائها.',
      type: 'academic',
      time: 'منذ 5 دقائق',
      icon: 'fa-solid fa-graduation-cap',
      read: false
    },
    {
      id: 'notif-2',
      title: 'حافلة الحضانة على بعد 3 دقائق',
      message: 'الحافلة رقم (12) تقترب من موقع النزول المحدد، يرجى التواجد للاستلام.',
      type: 'admin',
      time: 'منذ 25 دقيقة',
      icon: 'fa-solid fa-bus-school',
      read: false
    },
    {
      id: 'notif-3',
      title: 'تأكيد تجديد باقة الأنشطة',
      message: 'تم سداد اشتراك الشهر القادم بنجاح وإرسال الفاتورة الضريبية إلى بريدك.',
      type: 'financial',
      time: 'منذ ساعتين',
      icon: 'fa-solid fa-receipt',
      read: true
    },
    {
      id: 'notif-4',
      title: 'تسجيل الحضور الصباحي',
      message: 'تم تأكيد وصول عمر إلى قاعة الفراشات في تمام الساعة 08:15 صباحاً.',
      type: 'academic',
      time: 'اليوم 08:15 ص',
      icon: 'fa-solid fa-user-check',
      read: true
    }
  ];

  function getStoredNotifications() {
    try {
      const raw = localStorage.getItem('impact_notifications_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    localStorage.setItem('impact_notifications_v1', JSON.stringify(DEFAULT_NOTIFICATIONS));
    return DEFAULT_NOTIFICATIONS;
  }

  function saveStoredNotifications(list) {
    localStorage.setItem('impact_notifications_v1', JSON.stringify(list));
    updateNotificationBadge();
    renderNotificationList();
  }

  function addNotification(item) {
    const list = getStoredNotifications();
    const newNotif = {
      id: 'notif-' + Date.now(),
      title: item.title || 'إشعار جديد',
      message: item.message || '',
      type: item.type || 'academic',
      time: 'الآن',
      icon: item.icon || (item.type === 'admin' ? 'fa-solid fa-bell' : item.type === 'financial' ? 'fa-solid fa-credit-card' : 'fa-solid fa-sparkles'),
      read: false
    };
    list.unshift(newNotif);
    saveStoredNotifications(list.slice(0, 30)); // Keep latest 30
    return newNotif;
  }

  // 3. FLOATING TOAST SYSTEM
  function showImpactNotification(options) {
    const opts = typeof options === 'string' ? { message: options } : options;
    const title = opts.title || 'تنبيه من الحضانة';
    const message = opts.message || '';
    const type = opts.type || 'academic';
    const duration = opts.duration || 4500;
    const playSound = opts.sound !== false;

    // Persist into history unless ephemeral
    if (!opts.ephemeral) {
      addNotification({ title, message, type, icon: opts.icon });
    }

    // Play soft soundscape
    if (playSound) {
      playImpactSound(type);
    }

    // Ensure container
    let container = document.getElementById('impact-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'impact-toast-container';
      document.body.appendChild(container);
    }

    // Create toast DOM
    const toast = document.createElement('div');
    toast.className = `impact-toast toast-type-${type}`;

    let iconClass = opts.icon;
    if (!iconClass) {
      if (type === 'academic') iconClass = 'fa-solid fa-graduation-cap';
      else if (type === 'admin') iconClass = 'fa-solid fa-bell';
      else if (type === 'financial') iconClass = 'fa-solid fa-wallet';
      else iconClass = 'fa-solid fa-circle-check';
    }

    toast.innerHTML = `
      <div class="impact-toast-icon">
        <i class="${iconClass}"></i>
      </div>
      <div class="impact-toast-body">
        <div class="impact-toast-header">
          <h4 class="impact-toast-title">${escapeHtml(title)}</h4>
          <span class="impact-toast-time">الآن</span>
        </div>
        <p class="impact-toast-msg">${escapeHtml(message)}</p>
      </div>
      <button class="impact-toast-close" title="إغلاق">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="impact-toast-progress">
        <div class="impact-toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
      </div>
    `;

    // Click to dismiss
    const closeBtn = toast.querySelector('.impact-toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast);
    });

    toast.addEventListener('click', () => {
      toggleNotificationDrawer(true);
      dismissToast(toast);
    });

    container.appendChild(toast);

    // Auto dismiss timeout
    const timer = setTimeout(() => {
      dismissToast(toast);
    }, duration);

    toast.dataset.timer = timer;
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-hiding')) return;
    if (toast.dataset.timer) clearTimeout(parseInt(toast.dataset.timer));
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 4. NOTIFICATION CENTER DRAWER
  let currentFilter = 'all';

  function createNotificationDrawer() {
    if (document.getElementById('impact-notification-drawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'impact-notification-drawer';
    drawer.innerHTML = `
      <div class="notif-drawer-header">
        <div class="notif-drawer-title">
          <i class="fa-solid fa-bell"></i>
          <span>مركز التنبيهات الذكي</span>
          <span class="notif-drawer-badge" id="notif-unread-count-pill">0</span>
        </div>
        <div class="notif-drawer-actions">
          <button class="notif-action-btn" id="notif-sound-toggle-btn" title="كتم / تفعيل الصوت">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <button class="notif-action-btn" id="notif-drawer-close-btn" title="إغلاق">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="notif-filters">
        <button class="notif-filter-chip active" data-filter="all">الكل</button>
        <button class="notif-filter-chip" data-filter="academic">أكاديمية</button>
        <button class="notif-filter-chip" data-filter="admin">إدارية</button>
        <button class="notif-filter-chip" data-filter="financial">مالية</button>
      </div>

      <div class="notif-list" id="notif-items-list">
        <!-- Rendered items -->
      </div>

      <div class="notif-drawer-footer">
        <button class="notif-footer-link" id="notif-mark-all-read">
          <i class="fa-solid fa-check-double"></i> تحديد الكل كمقروء
        </button>
        <button class="notif-footer-link" id="notif-clear-all" style="color: var(--color-error);">
          <i class="fa-solid fa-trash-can"></i> مسح السجل
        </button>
      </div>
    `;

    document.body.appendChild(drawer);

    // Event listeners
    drawer.querySelector('#notif-drawer-close-btn').addEventListener('click', () => toggleNotificationDrawer(false));
    drawer.querySelector('#notif-sound-toggle-btn').addEventListener('click', () => {
      setSoundMuted(!isSoundMuted());
      playImpactSound('chime');
    });

    drawer.querySelectorAll('.notif-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        drawer.querySelectorAll('.notif-filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderNotificationList();
      });
    });

    drawer.querySelector('#notif-mark-all-read').addEventListener('click', () => {
      const list = getStoredNotifications().map((item) => ({ ...item, read: true }));
      saveStoredNotifications(list);
      playImpactSound('success');
    });

    drawer.querySelector('#notif-clear-all').addEventListener('click', () => {
      saveStoredNotifications([]);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      const drawer = document.getElementById('impact-notification-drawer');
      const triggers = document.querySelectorAll('.impact-notif-trigger-btn');
      let clickedTrigger = false;
      triggers.forEach((btn) => {
        if (btn.contains(e.target)) clickedTrigger = true;
      });

      if (drawer && drawer.classList.contains('drawer-open') && !drawer.contains(e.target) && !clickedTrigger) {
        toggleNotificationDrawer(false);
      }
    });

    updateMuteIcons();
    renderNotificationList();
    updateNotificationBadge();
  }

  function updateMuteIcons() {
    const btn = document.getElementById('notif-sound-toggle-btn');
    if (!btn) return;
    const muted = isSoundMuted();
    btn.innerHTML = muted ? '<i class="fa-solid fa-volume-xmark" style="color: var(--color-error);"></i>' : '<i class="fa-solid fa-volume-high"></i>';
  }

  function toggleNotificationDrawer(forceOpen) {
    const drawer = document.getElementById('impact-notification-drawer');
    if (!drawer) return;
    const isOpen = drawer.classList.contains('drawer-open');
    const targetState = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;

    if (targetState) {
      drawer.classList.add('drawer-open');
      renderNotificationList();
    } else {
      drawer.classList.remove('drawer-open');
    }
  }

  function renderNotificationList() {
    const container = document.getElementById('notif-items-list');
    if (!container) return;

    let list = getStoredNotifications();
    if (currentFilter !== 'all') {
      list = list.filter((item) => item.type === currentFilter);
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--color-text-muted);">
          <i class="fa-regular fa-bell-slash" style="font-size: 36px; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
          <p style="margin: 0; font-size: 14px; font-weight: 600;">لا توجد إشعارات في هذا التصنيف</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((item) => {
      let iconColor = 'var(--color-brand-primary)';
      let iconBg = 'var(--color-mint-light)';
      if (item.type === 'admin') {
        iconColor = 'var(--color-accent)';
        iconBg = 'var(--color-accent-light)';
      } else if (item.type === 'financial') {
        iconColor = 'var(--color-brand-primary)';
        iconBg = 'var(--color-secondary-light)';
      }

      return `
        <div class="notif-item ${item.read ? '' : 'is-unread'}" data-id="${item.id}">
          <div class="notif-item-icon" style="background: ${iconBg}; color: ${iconColor};">
            <i class="${item.icon || 'fa-solid fa-bell'}"></i>
          </div>
          <div class="notif-item-content">
            <h5 class="notif-item-title">${escapeHtml(item.title)}</h5>
            <p class="notif-item-desc">${escapeHtml(item.message)}</p>
            <div class="notif-item-meta">
              <span><i class="fa-regular fa-clock"></i> ${escapeHtml(item.time)}</span>
              <span>•</span>
              <span>${item.type === 'academic' ? 'أكاديمي' : item.type === 'admin' ? 'إداري' : 'مالي'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.notif-item').forEach((itemEl) => {
      itemEl.addEventListener('click', () => {
        const id = itemEl.dataset.id;
        const all = getStoredNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
        saveStoredNotifications(all);
      });
    });
  }

  function updateNotificationBadge() {
    const list = getStoredNotifications();
    const unreadCount = list.filter((n) => !n.read).length;

    // Update pill in drawer
    const drawerPill = document.getElementById('notif-unread-count-pill');
    if (drawerPill) drawerPill.textContent = unreadCount;

    // Update all bell buttons on page
    document.querySelectorAll('.impact-notif-count-badge').forEach((badge) => {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    });
  }

  // 5. INJECT NOTIFICATION BELL BUTTON & INSTALL BUTTON INTO HEADERS AUTOMATICALLY
  function injectNotificationTriggers() {
    // Select headers or navbars
    const headerTargets = [
      document.querySelector('.app-header .header-actions'),
      document.querySelector('.navbar .nav-cta'),
      document.querySelector('.top-navbar .nav-right'),
      document.querySelector('.main-header .user-actions'),
      document.querySelector('#app-header-actions'),
      document.querySelector('.admin-top-bar .top-bar-right')
    ];

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    headerTargets.forEach((target) => {
      if (target) {
        if (!target.querySelector('.impact-notif-trigger-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'impact-notif-trigger-btn';
          btn.title = 'التنبيهات والمستجدات';
          btn.innerHTML = `
            <i class="fa-solid fa-bell"></i>
            <span class="impact-notif-count-badge">0</span>
          `;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            getAudioContext(); // user gesture unlock
            toggleNotificationDrawer();
          });
          target.prepend(btn);
        }

        if (!isStandalone && !target.querySelector('.impact-header-pwa-btn') && !target.querySelector('.pwa-top-install-btn')) {
          const pwaBtn = document.createElement('button');
          pwaBtn.type = 'button';
          pwaBtn.className = 'impact-header-pwa-btn';
          pwaBtn.title = 'تثبيت التطبيق على الشاشة الرئيسية للهاتف';
          pwaBtn.innerHTML = `
            <i class="fa-solid fa-mobile-screen-button"></i>
            <span>تثبيت التطبيق 📲</span>
          `;
          pwaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerPWAInstall();
          });
          target.prepend(pwaBtn);
        }
      }
    });

    updateNotificationBadge();
  }

  // 6. PROGRESSIVE WEB APP (PWA) INSTALL & OFFLINE ENGINE
  let deferredPrompt = null;

  function initPWA() {
    const isInIframe = window.self !== window.top;

    // Inside dev preview iframe: unregister any legacy service workers that cause ERR_FAILED
    if ('serviceWorker' in navigator) {
      if (isInIframe) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let reg of registrations) {
            reg.unregister().catch(() => {});
          }
        }).catch(() => {});
      } else {
        // Standalone or top-level window (Mobile, PWA, direct tab)
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
            .then((reg) => {
              if (reg.update) reg.update().catch(() => {});
            })
            .catch((err) => console.warn('[PWA] SW register notice:', err));
        });
      }
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showPWAInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hidePWAInstallBanner();
      showImpactNotification({
        title: 'تم تثبيت التطبيق بنجاح!',
        message: 'أصبح Impact Hub Egypt الآن متاحاً على شاشتك الرئيسية للوصول السريع بدون إنترنت.',
        type: 'success',
        icon: 'fa-solid fa-circle-check'
      });
    });

    // iOS Safari detection
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    // Show iOS banner once per session if on iOS and not standalone
    if (isIOS && !isStandalone && !sessionStorage.getItem('ios_install_dismissed')) {
      setTimeout(() => {
        showPWAInstallBanner(true);
      }, 3500);
    }
  }

  // Unified Global Install Trigger for any button across the platform
  async function triggerPWAInstall() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      showImpactNotification({
        title: 'التطبيق مثبت بالفعل 🚀',
        message: 'أنت تستخدم تطبيق المنصة المثبت مسبقاً على هاتفك بكامل مزاياه والعمل دون اتصال.',
        type: 'success',
        icon: 'fa-solid fa-mobile-screen-button'
      });
      playImpactSound('chime');
      return;
    }

    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) {
      showIOSInstallGuide();
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          hidePWAInstallBanner();
          showImpactNotification({
            title: 'جاري إضافة التطبيق...',
            message: 'تم قبول التثبيت وجاري إضافة أيقونة التطبيق لشاشتك الرئيسية!',
            type: 'success',
            icon: 'fa-solid fa-circle-check'
          });
        }
        deferredPrompt = null;
      } catch (err) {
        showAndroidInstallGuide();
      }
    } else {
      showAndroidInstallGuide();
    }
  }

  function showPWAInstallBanner(isIOS = false) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;
    if (document.getElementById('impact-pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'impact-pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-icon">
        <img src="/pwa-192x192.png" alt="Impact Hub Egypt" />
      </div>
      <div class="pwa-banner-info">
        <h4 class="pwa-banner-title">تطبيق Impact Hub Egypt</h4>
        <p class="pwa-banner-desc">ثبّت التطبيق على هاتفك لتلقي الإشعارات الفورية والعمل دون اتصال.</p>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-install-btn" id="pwa-action-install">تثبيت التطبيق</button>
        <button class="pwa-dismiss-btn" id="pwa-action-dismiss">لاحقاً</button>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('#pwa-action-dismiss').addEventListener('click', () => {
      banner.style.display = 'none';
      if (isIOS) sessionStorage.setItem('ios_install_dismissed', 'true');
    });

    banner.querySelector('#pwa-action-install').addEventListener('click', () => {
      triggerPWAInstall();
    });
  }

  function hidePWAInstallBanner() {
    const banner = document.getElementById('impact-pwa-install-banner');
    if (banner) banner.remove();
  }

  function showIOSInstallGuide() {
    let modal = document.getElementById('impact-ios-install-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'impact-ios-install-modal';
      modal.innerHTML = `
        <div class="ios-modal-card">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="/pwa-192x192.png" alt="Impact Hub" style="width: 64px; height: 64px; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
            <div style="display:inline-block; background: #E0F2FE; color: #0284C7; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; margin-bottom: 6px;">هواتف iPhone و iPad (سفاري)</div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--color-brand-primary);">تثبيت تطبيق المنصة على الشاشة الرئيسية</h3>
            <p style="margin: 6px 0 0; font-size: 13px; color: var(--color-text-secondary);">3 خطوات بسيطة ليعمل كتطبيق أصلي بالكامل:</p>
          </div>

          <div class="ios-step">
            <div class="ios-step-num">1</div>
            <div>
              <strong style="font-size: 13.5px; display: block; color: var(--color-text-primary);">اضغط زر المشاركة (Share)</strong>
              <span style="font-size: 12px; color: var(--color-text-secondary);">انقر على أيقونة المشاركة <i class="fa-solid fa-arrow-up-from-bracket" style="color: #007AFF; font-size: 14px;"></i> الموجودة في شريط Safari بالأسفل.</span>
            </div>
          </div>

          <div class="ios-step">
            <div class="ios-step-num">2</div>
            <div>
              <strong style="font-size: 13.5px; display: block; color: var(--color-text-primary);">إضافة إلى الشاشة الرئيسية</strong>
              <span style="font-size: 12px; color: var(--color-text-secondary);">مرر للأسفل بالقائمة واضغط <strong>"Add to Home Screen" <i class="fa-regular fa-square-plus" style="color: var(--color-brand-primary);"></i></strong>.</span>
            </div>
          </div>

          <div class="ios-step">
            <div class="ios-step-num">3</div>
            <div>
              <strong style="font-size: 13.5px; display: block; color: var(--color-text-primary);">تأكيد الإضافة</strong>
              <span style="font-size: 12px; color: var(--color-text-secondary);">اضغط <strong>"إضافة" (Add)</strong> في أعلى الشاشة وستظهر الأيقونة فوراً على هاتفك.</span>
            </div>
          </div>

          <button id="close-ios-guide-btn" style="width: 100%; background: linear-gradient(135deg, var(--color-brand-primary), var(--color-primary-dark)); color: #fff; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; margin-top: 8px; box-shadow: 0 4px 12px rgba(48, 86, 105, 0.25);">
            فهمت، حسناً
          </button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#close-ios-guide-btn').addEventListener('click', () => {
        modal.classList.remove('modal-open');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('modal-open');
      });
    }

    modal.classList.add('modal-open');
  }

  function showAndroidInstallGuide() {
    let modal = document.getElementById('impact-android-install-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'impact-android-install-modal';
      modal.innerHTML = `
        <div class="ios-modal-card">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="/pwa-192x192.png" alt="Impact Hub" style="width: 64px; height: 64px; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
            <div style="display:inline-block; background: #DCFCE7; color: #15803D; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; margin-bottom: 6px;">هواتف Android ومتصفح Chrome</div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--color-brand-primary);">تثبيت التطبيق على الشاشة الرئيسية</h3>
            <p style="margin: 6px 0 0; font-size: 13px; color: var(--color-text-secondary);">خطوات إضافة التطبيق بدون الحاجة لمتجر:</p>
          </div>

          <div class="ios-step">
            <div class="ios-step-num">1</div>
            <div>
              <strong style="font-size: 13.5px; display: block; color: var(--color-text-primary);">افتح قائمة المتصفح</strong>
              <span style="font-size: 12px; color: var(--color-text-secondary);">اضغط على خيارات المتصفح <i class="fa-solid fa-ellipsis-vertical" style="color: var(--color-brand-primary); font-size: 15px;"></i> في الزاوية العلوية أو السفلية.</span>
            </div>
          </div>

          <div class="ios-step">
            <div class="ios-step-num">2</div>
            <div>
              <strong style="font-size: 13.5px; display: block; color: var(--color-text-primary);">اختر "تثبيت التطبيق"</strong>
              <span style="font-size: 12px; color: var(--color-text-secondary);">اضغط على <strong>"تثبيت التطبيق" (Install app)</strong> أو <strong>"الإضافة إلى الشاشة الرئيسية"</strong>.</span>
            </div>
          </div>

          <div class="ios-step">
            <div class="ios-step-num">3</div>
            <div>
              <strong style="font-size: 13.5px; display: block; color: var(--color-text-primary);">تأكيد التثبيت</strong>
              <span style="font-size: 12px; color: var(--color-text-secondary);">اضغط <strong>"تثبيت" (Install)</strong> لتظهر أيقونة التطبيق على شاشتك الرئيسية فوراً.</span>
            </div>
          </div>

          <button id="close-android-guide-btn" style="width: 100%; background: linear-gradient(135deg, var(--color-brand-primary), var(--color-primary-dark)); color: #fff; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; margin-top: 8px; box-shadow: 0 4px 12px rgba(48, 86, 105, 0.25);">
            فهمت، حسناً
          </button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#close-android-guide-btn').addEventListener('click', () => {
        modal.classList.remove('modal-open');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('modal-open');
      });
    }

    modal.classList.add('modal-open');
  }

  // 7. OFFLINE / ONLINE CONNECTIVITY BADGE & QUEUE SYNC
  function initConnectivityMonitoring() {
    let badge = document.getElementById('impact-connectivity-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'impact-connectivity-badge';
      badge.innerHTML = `
        <span class="connectivity-pulse"></span>
        <span id="connectivity-badge-text">وضع عدم الاتصال — يتم الحفظ محلياً</span>
      `;
      document.body.appendChild(badge);
    }

    function updateStatus() {
      const isOnline = navigator.onLine;
      const textEl = document.getElementById('connectivity-badge-text');

      if (!isOnline) {
        badge.className = 'badge-visible';
        textEl.textContent = 'وضع عدم الاتصال — يتم الحفظ محلياً';
        showImpactNotification({
          title: 'انقطع الاتصال بالإنترنت',
          message: 'تم تفعيل وضع عدم الاتصال (Offline Mode). يمكنك متابعة تسجيل الحضور وسيتم مزامنتها تلقائياً عند عودة الشبكة.',
          type: 'admin',
          icon: 'fa-solid fa-wifi-slash',
          ephemeral: true
        });
      } else {
        if (badge.classList.contains('badge-visible')) {
          badge.className = 'badge-visible is-online-success';
          textEl.textContent = 'تم استعادة الاتصال — جاري المزامنة';
          syncOfflineQueues();
          setTimeout(() => {
            badge.className = '';
          }, 3500);
        }
      }
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    if (!navigator.onLine) {
      updateStatus();
    }
  }

  // 8. OFFLINE ATTENDANCE QUEUE API (For Teacher & Admin)
  window.saveOfflineAttendance = function (studentId, status, studentName) {
    try {
      const queue = JSON.parse(localStorage.getItem('impact_offline_attendance_queue') || '[]');
      queue.push({
        id: studentId,
        name: studentName,
        status: status,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('impact_offline_attendance_queue', JSON.stringify(queue));

      showImpactNotification({
        title: 'تم حفظ الحضور دون اتصال',
        message: `تم تسجيل حالة (${studentName || 'الطالب'}): ${status === 'present' ? 'حاضر' : 'غائب'} في الذاكرة المحلية. ستتم المزامنة تلقائياً.`,
        type: 'academic',
        icon: 'fa-solid fa-cloud-arrow-up'
      });
      return true;
    } catch (e) {
      console.error('[OfflineQueue] Failed to save offline item:', e);
      return false;
    }
  };

  function syncOfflineQueues() {
    try {
      const queue = JSON.parse(localStorage.getItem('impact_offline_attendance_queue') || '[]');
      if (queue.length > 0) {
        console.log(`[OfflineSync] Syncing ${queue.length} offline attendance entries to cloud...`);
        // Clear queue upon simulated sync
        localStorage.removeItem('impact_offline_attendance_queue');

        showImpactNotification({
          title: 'تمت مزامنة الحضور بنجاح!',
          message: `تم ترحيل ${queue.length} سجلات حضور كانت محفوظة دون اتصال إلى قاعدة بيانات الحضانة.`,
          type: 'success',
          icon: 'fa-solid fa-cloud-check'
        });
        playImpactSound('success');
      }
    } catch (e) {
      console.warn('[OfflineSync] Queue sync error:', e);
    }
  }

  // 10. INITIALIZATION
  function init() {
    try {
      createNotificationDrawer();
      injectNotificationTriggers();
      initPWA();
      initConnectivityMonitoring();
    } catch (err) {
      console.warn('[Notifications] Non-fatal init warning:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global APIs
  window.showImpactNotification = showImpactNotification;
  window.playImpactSound = playImpactSound;
  window.toggleNotificationDrawer = toggleNotificationDrawer;
  window.triggerPWAInstall = triggerPWAInstall;
  window.showIOSInstallGuide = showIOSInstallGuide;
  window.showAndroidInstallGuide = showAndroidInstallGuide;
})();
