import { BRAND } from './tokens';

// Animation Styles - Keyframes and transitions
export const ANIMATION_STYLES = `
  /* Shimmer Loading Animation */
  @keyframes shimmer { 
    0% { background-position: -1000px 0; } 
    100% { background-position: 1000px 0; } 
  }
  .animate-shimmer { 
    animation: shimmer 2s infinite linear; 
    background: linear-gradient(to right, #f3e8ff 4%, #e9d5ff 25%, #f3e8ff 36%); 
    background-size: 1000px 100%; 
  }
  
  /* Striped Background */
  .bg-stripes-gray { 
    background-image: linear-gradient(45deg, #f1f5f9 25%, #ffffff 25%, #ffffff 50%, #f1f5f9 50%, #f1f5f9 75%, #ffffff 75%, #ffffff 100%); 
    background-size: 20px 20px; 
  }
  
  /* Modal Animations */
  @keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes modalSlideIn {
    from { 
      opacity: 0; 
      transform: translateY(-20px) scale(0.95); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0) scale(1); 
    }
  }
  .modal-backdrop {
    animation: modalFadeIn 0.2s ease-out;
  }
  .modal-content {
    animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  
  /* Smooth Transitions - Global */
  * {
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Focus Indicators - Accessibility */
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  [role="button"]:focus-visible {
    outline: 2px solid ${BRAND.primary};
    outline-offset: 2px;
    border-radius: 6px;
  }
  
  /* Hover Effects - Buttons */
  button:not(:disabled):hover,
  [role="button"]:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(129, 65, 177, 0.15);
  }
  button:not(:disabled):active,
  [role="button"]:active {
    transform: translateY(0);
  }
  
  /* Card Hover Effects */
  .card-hover {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }
  
  /* Loading Skeleton */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes skeletonShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .skeleton {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: skeletonShimmer 1.5s ease-in-out infinite;
  }
  
  /* Dropdown Animations */
  @keyframes dropdownSlideIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .dropdown-enter {
    animation: dropdownSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }
  
  /* Toast Animations */
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes toastSlideOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
  .toast-enter {
    animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .toast-exit {
    animation: toastSlideOut 0.2s ease-in;
  }
  
  /* Ripple Effect */
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    width: 20px;
    height: 20px;
    animation: ripple 0.6s ease-out;
    pointer-events: none;
  }
  
  /* Smooth Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
    transition: background 0.2s;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  
  /* Disabled State */
  button:disabled,
  input:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
  
  /* Link Hover */
  a:hover {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }
`;
