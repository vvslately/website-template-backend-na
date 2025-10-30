<html lang="en">

<head>
    <style type="text/css">
        :root {
            --toastify-color-light: #fff;
            --toastify-color-dark: #121212;
            --toastify-color-info: #3498db;
            --toastify-color-success: #07bc0c;
            --toastify-color-warning: #f1c40f;
            --toastify-color-error: hsl(6, 78%, 57%);
            --toastify-color-transparent: rgba(255, 255, 255, .7);
            --toastify-icon-color-info: var(--toastify-color-info);
            --toastify-icon-color-success: var(--toastify-color-success);
            --toastify-icon-color-warning: var(--toastify-color-warning);
            --toastify-icon-color-error: var(--toastify-color-error);
            --toastify-container-width: fit-content;
            --toastify-toast-width: 320px;
            --toastify-toast-offset: 16px;
            --toastify-toast-top: max(var(--toastify-toast-offset), env(safe-area-inset-top));
            --toastify-toast-right: max(var(--toastify-toast-offset), env(safe-area-inset-right));
            --toastify-toast-left: max(var(--toastify-toast-offset), env(safe-area-inset-left));
            --toastify-toast-bottom: max(var(--toastify-toast-offset), env(safe-area-inset-bottom));
            --toastify-toast-background: #fff;
            --toastify-toast-padding: 14px;
            --toastify-toast-min-height: 64px;
            --toastify-toast-max-height: 800px;
            --toastify-toast-bd-radius: 6px;
            --toastify-toast-shadow: 0px 4px 12px rgba(0, 0, 0, .1);
            --toastify-font-family: sans-serif;
            --toastify-z-index: 9999;
            --toastify-text-color-light: #757575;
            --toastify-text-color-dark: #fff;
            --toastify-text-color-info: #fff;
            --toastify-text-color-success: #fff;
            --toastify-text-color-warning: #fff;
            --toastify-text-color-error: #fff;
            --toastify-spinner-color: #616161;
            --toastify-spinner-color-empty-area: #e0e0e0;
            --toastify-color-progress-light: linear-gradient(to right, #4cd964, #5ac8fa, #007aff, #34aadc, #5856d6, #ff2d55);
            --toastify-color-progress-dark: #bb86fc;
            --toastify-color-progress-info: var(--toastify-color-info);
            --toastify-color-progress-success: var(--toastify-color-success);
            --toastify-color-progress-warning: var(--toastify-color-warning);
            --toastify-color-progress-error: var(--toastify-color-error);
            --toastify-color-progress-bgo: .2
        }

        .Toastify__toast-container {
            z-index: var(--toastify-z-index);
            -webkit-transform: translate3d(0, 0, var(--toastify-z-index));
            position: fixed;
            width: var(--toastify-container-width);
            box-sizing: border-box;
            color: #fff;
            display: flex;
            flex-direction: column
        }

        .Toastify__toast-container--top-left {
            top: var(--toastify-toast-top);
            left: var(--toastify-toast-left)
        }

        .Toastify__toast-container--top-center {
            top: var(--toastify-toast-top);
            left: 50%;
            transform: translate(-50%);
            align-items: center
        }

        .Toastify__toast-container--top-right {
            top: var(--toastify-toast-top);
            right: var(--toastify-toast-right);
            align-items: end
        }

        .Toastify__toast-container--bottom-left {
            bottom: var(--toastify-toast-bottom);
            left: var(--toastify-toast-left)
        }

        .Toastify__toast-container--bottom-center {
            bottom: var(--toastify-toast-bottom);
            left: 50%;
            transform: translate(-50%);
            align-items: center
        }

        .Toastify__toast-container--bottom-right {
            bottom: var(--toastify-toast-bottom);
            right: var(--toastify-toast-right);
            align-items: end
        }

        .Toastify__toast {
            --y: 0;
            position: relative;
            touch-action: none;
            width: var(--toastify-toast-width);
            min-height: var(--toastify-toast-min-height);
            box-sizing: border-box;
            margin-bottom: 1rem;
            padding: var(--toastify-toast-padding);
            border-radius: var(--toastify-toast-bd-radius);
            box-shadow: var(--toastify-toast-shadow);
            max-height: var(--toastify-toast-max-height);
            font-family: var(--toastify-font-family);
            z-index: 0;
            display: flex;
            flex: 1 auto;
            align-items: center;
            word-break: break-word
        }

        @media only screen and (max-width: 480px) {
            .Toastify__toast-container {
                width: 100vw;
                left: env(safe-area-inset-left);
                margin: 0
            }

            .Toastify__toast-container--top-left,
            .Toastify__toast-container--top-center,
            .Toastify__toast-container--top-right {
                top: env(safe-area-inset-top);
                transform: translate(0)
            }

            .Toastify__toast-container--bottom-left,
            .Toastify__toast-container--bottom-center,
            .Toastify__toast-container--bottom-right {
                bottom: env(safe-area-inset-bottom);
                transform: translate(0)
            }

            .Toastify__toast-container--rtl {
                right: env(safe-area-inset-right);
                left: initial
            }

            .Toastify__toast {
                --toastify-toast-width: 100%;
                margin-bottom: 0;
                border-radius: 0
            }
        }

        .Toastify__toast-container[data-stacked=true] {
            width: var(--toastify-toast-width)
        }

        .Toastify__toast--stacked {
            position: absolute;
            width: 100%;
            transform: translate3d(0, var(--y), 0) scale(var(--s));
            transition: transform .3s
        }

        .Toastify__toast--stacked[data-collapsed] .Toastify__toast-body,
        .Toastify__toast--stacked[data-collapsed] .Toastify__close-button {
            transition: opacity .1s
        }

        .Toastify__toast--stacked[data-collapsed=false] {
            overflow: visible
        }

        .Toastify__toast--stacked[data-collapsed=true]:not(:last-child)>* {
            opacity: 0
        }

        .Toastify__toast--stacked:after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            height: calc(var(--g) * 1px);
            bottom: 100%
        }

        .Toastify__toast--stacked[data-pos=top] {
            top: 0
        }

        .Toastify__toast--stacked[data-pos=bot] {
            bottom: 0
        }

        .Toastify__toast--stacked[data-pos=bot].Toastify__toast--stacked:before {
            transform-origin: top
        }

        .Toastify__toast--stacked[data-pos=top].Toastify__toast--stacked:before {
            transform-origin: bottom
        }

        .Toastify__toast--stacked:before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 100%;
            transform: scaleY(3);
            z-index: -1
        }

        .Toastify__toast--rtl {
            direction: rtl
        }

        .Toastify__toast--close-on-click {
            cursor: pointer
        }

        .Toastify__toast-icon {
            margin-inline-end: 10px;
            width: 22px;
            flex-shrink: 0;
            display: flex
        }

        .Toastify--animate {
            animation-fill-mode: both;
            animation-duration: .5s
        }

        .Toastify--animate-icon {
            animation-fill-mode: both;
            animation-duration: .3s
        }

        .Toastify__toast-theme--dark {
            background: var(--toastify-color-dark);
            color: var(--toastify-text-color-dark)
        }

        .Toastify__toast-theme--light,
        .Toastify__toast-theme--colored.Toastify__toast--default {
            background: var(--toastify-color-light);
            color: var(--toastify-text-color-light)
        }

        .Toastify__toast-theme--colored.Toastify__toast--info {
            color: var(--toastify-text-color-info);
            background: var(--toastify-color-info)
        }

        .Toastify__toast-theme--colored.Toastify__toast--success {
            color: var(--toastify-text-color-success);
            background: var(--toastify-color-success)
        }

        .Toastify__toast-theme--colored.Toastify__toast--warning {
            color: var(--toastify-text-color-warning);
            background: var(--toastify-color-warning)
        }

        .Toastify__toast-theme--colored.Toastify__toast--error {
            color: var(--toastify-text-color-error);
            background: var(--toastify-color-error)
        }

        .Toastify__progress-bar-theme--light {
            background: var(--toastify-color-progress-light)
        }

        .Toastify__progress-bar-theme--dark {
            background: var(--toastify-color-progress-dark)
        }

        .Toastify__progress-bar--info {
            background: var(--toastify-color-progress-info)
        }

        .Toastify__progress-bar--success {
            background: var(--toastify-color-progress-success)
        }

        .Toastify__progress-bar--warning {
            background: var(--toastify-color-progress-warning)
        }

        .Toastify__progress-bar--error {
            background: var(--toastify-color-progress-error)
        }

        .Toastify__progress-bar-theme--colored.Toastify__progress-bar--info,
        .Toastify__progress-bar-theme--colored.Toastify__progress-bar--success,
        .Toastify__progress-bar-theme--colored.Toastify__progress-bar--warning,
        .Toastify__progress-bar-theme--colored.Toastify__progress-bar--error {
            background: var(--toastify-color-transparent)
        }

        .Toastify__close-button {
            color: #fff;
            position: absolute;
            top: 6px;
            right: 6px;
            background: transparent;
            outline: none;
            border: none;
            padding: 0;
            cursor: pointer;
            opacity: .7;
            transition: .3s ease;
            z-index: 1
        }

        .Toastify__toast--rtl .Toastify__close-button {
            left: 6px;
            right: unset
        }

        .Toastify__close-button--light {
            color: #000;
            opacity: .3
        }

        .Toastify__close-button>svg {
            fill: currentColor;
            height: 16px;
            width: 14px
        }

        .Toastify__close-button:hover,
        .Toastify__close-button:focus {
            opacity: 1
        }

        @keyframes Toastify__trackProgress {
            0% {
                transform: scaleX(1)
            }

            to {
                transform: scaleX(0)
            }
        }

        .Toastify__progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            opacity: .7;
            transform-origin: left
        }

        .Toastify__progress-bar--animated {
            animation: Toastify__trackProgress linear 1 forwards
        }

        .Toastify__progress-bar--controlled {
            transition: transform .2s
        }

        .Toastify__progress-bar--rtl {
            right: 0;
            left: initial;
            transform-origin: right;
            border-bottom-left-radius: initial
        }

        .Toastify__progress-bar--wrp {
            position: absolute;
            overflow: hidden;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 5px;
            border-bottom-left-radius: var(--toastify-toast-bd-radius);
            border-bottom-right-radius: var(--toastify-toast-bd-radius)
        }

        .Toastify__progress-bar--wrp[data-hidden=true] {
            opacity: 0
        }

        .Toastify__progress-bar--bg {
            opacity: var(--toastify-color-progress-bgo);
            width: 100%;
            height: 100%
        }

        .Toastify__spinner {
            width: 20px;
            height: 20px;
            box-sizing: border-box;
            border: 2px solid;
            border-radius: 100%;
            border-color: var(--toastify-spinner-color-empty-area);
            border-right-color: var(--toastify-spinner-color);
            animation: Toastify__spin .65s linear infinite
        }

        @keyframes Toastify__bounceInRight {

            0%,
            60%,
            75%,
            90%,
            to {
                animation-timing-function: cubic-bezier(.215, .61, .355, 1)
            }

            0% {
                opacity: 0;
                transform: translate3d(3000px, 0, 0)
            }

            60% {
                opacity: 1;
                transform: translate3d(-25px, 0, 0)
            }

            75% {
                transform: translate3d(10px, 0, 0)
            }

            90% {
                transform: translate3d(-5px, 0, 0)
            }

            to {
                transform: none
            }
        }

        @keyframes Toastify__bounceOutRight {
            20% {
                opacity: 1;
                transform: translate3d(-20px, var(--y), 0)
            }

            to {
                opacity: 0;
                transform: translate3d(2000px, var(--y), 0)
            }
        }

        @keyframes Toastify__bounceInLeft {

            0%,
            60%,
            75%,
            90%,
            to {
                animation-timing-function: cubic-bezier(.215, .61, .355, 1)
            }

            0% {
                opacity: 0;
                transform: translate3d(-3000px, 0, 0)
            }

            60% {
                opacity: 1;
                transform: translate3d(25px, 0, 0)
            }

            75% {
                transform: translate3d(-10px, 0, 0)
            }

            90% {
                transform: translate3d(5px, 0, 0)
            }

            to {
                transform: none
            }
        }

        @keyframes Toastify__bounceOutLeft {
            20% {
                opacity: 1;
                transform: translate3d(20px, var(--y), 0)
            }

            to {
                opacity: 0;
                transform: translate3d(-2000px, var(--y), 0)
            }
        }

        @keyframes Toastify__bounceInUp {

            0%,
            60%,
            75%,
            90%,
            to {
                animation-timing-function: cubic-bezier(.215, .61, .355, 1)
            }

            0% {
                opacity: 0;
                transform: translate3d(0, 3000px, 0)
            }

            60% {
                opacity: 1;
                transform: translate3d(0, -20px, 0)
            }

            75% {
                transform: translate3d(0, 10px, 0)
            }

            90% {
                transform: translate3d(0, -5px, 0)
            }

            to {
                transform: translateZ(0)
            }
        }

        @keyframes Toastify__bounceOutUp {
            20% {
                transform: translate3d(0, calc(var(--y) - 10px), 0)
            }

            40%,
            45% {
                opacity: 1;
                transform: translate3d(0, calc(var(--y) + 20px), 0)
            }

            to {
                opacity: 0;
                transform: translate3d(0, -2000px, 0)
            }
        }

        @keyframes Toastify__bounceInDown {

            0%,
            60%,
            75%,
            90%,
            to {
                animation-timing-function: cubic-bezier(.215, .61, .355, 1)
            }

            0% {
                opacity: 0;
                transform: translate3d(0, -3000px, 0)
            }

            60% {
                opacity: 1;
                transform: translate3d(0, 25px, 0)
            }

            75% {
                transform: translate3d(0, -10px, 0)
            }

            90% {
                transform: translate3d(0, 5px, 0)
            }

            to {
                transform: none
            }
        }

        @keyframes Toastify__bounceOutDown {
            20% {
                transform: translate3d(0, calc(var(--y) - 10px), 0)
            }

            40%,
            45% {
                opacity: 1;
                transform: translate3d(0, calc(var(--y) + 20px), 0)
            }

            to {
                opacity: 0;
                transform: translate3d(0, 2000px, 0)
            }
        }

        .Toastify__bounce-enter--top-left,
        .Toastify__bounce-enter--bottom-left {
            animation-name: Toastify__bounceInLeft
        }

        .Toastify__bounce-enter--top-right,
        .Toastify__bounce-enter--bottom-right {
            animation-name: Toastify__bounceInRight
        }

        .Toastify__bounce-enter--top-center {
            animation-name: Toastify__bounceInDown
        }

        .Toastify__bounce-enter--bottom-center {
            animation-name: Toastify__bounceInUp
        }

        .Toastify__bounce-exit--top-left,
        .Toastify__bounce-exit--bottom-left {
            animation-name: Toastify__bounceOutLeft
        }

        .Toastify__bounce-exit--top-right,
        .Toastify__bounce-exit--bottom-right {
            animation-name: Toastify__bounceOutRight
        }

        .Toastify__bounce-exit--top-center {
            animation-name: Toastify__bounceOutUp
        }

        .Toastify__bounce-exit--bottom-center {
            animation-name: Toastify__bounceOutDown
        }

        @keyframes Toastify__zoomIn {
            0% {
                opacity: 0;
                transform: scale3d(.3, .3, .3)
            }

            50% {
                opacity: 1
            }
        }

        @keyframes Toastify__zoomOut {
            0% {
                opacity: 1
            }

            50% {
                opacity: 0;
                transform: translate3d(0, var(--y), 0) scale3d(.3, .3, .3)
            }

            to {
                opacity: 0
            }
        }

        .Toastify__zoom-enter {
            animation-name: Toastify__zoomIn
        }

        .Toastify__zoom-exit {
            animation-name: Toastify__zoomOut
        }

        @keyframes Toastify__flipIn {
            0% {
                transform: perspective(400px) rotateX(90deg);
                animation-timing-function: ease-in;
                opacity: 0
            }

            40% {
                transform: perspective(400px) rotateX(-20deg);
                animation-timing-function: ease-in
            }

            60% {
                transform: perspective(400px) rotateX(10deg);
                opacity: 1
            }

            80% {
                transform: perspective(400px) rotateX(-5deg)
            }

            to {
                transform: perspective(400px)
            }
        }

        @keyframes Toastify__flipOut {
            0% {
                transform: translate3d(0, var(--y), 0) perspective(400px)
            }

            30% {
                transform: translate3d(0, var(--y), 0) perspective(400px) rotateX(-20deg);
                opacity: 1
            }

            to {
                transform: translate3d(0, var(--y), 0) perspective(400px) rotateX(90deg);
                opacity: 0
            }
        }

        .Toastify__flip-enter {
            animation-name: Toastify__flipIn
        }

        .Toastify__flip-exit {
            animation-name: Toastify__flipOut
        }

        @keyframes Toastify__slideInRight {
            0% {
                transform: translate3d(110%, 0, 0);
                visibility: visible
            }

            to {
                transform: translate3d(0, var(--y), 0)
            }
        }

        @keyframes Toastify__slideInLeft {
            0% {
                transform: translate3d(-110%, 0, 0);
                visibility: visible
            }

            to {
                transform: translate3d(0, var(--y), 0)
            }
        }

        @keyframes Toastify__slideInUp {
            0% {
                transform: translate3d(0, 110%, 0);
                visibility: visible
            }

            to {
                transform: translate3d(0, var(--y), 0)
            }
        }

        @keyframes Toastify__slideInDown {
            0% {
                transform: translate3d(0, -110%, 0);
                visibility: visible
            }

            to {
                transform: translate3d(0, var(--y), 0)
            }
        }

        @keyframes Toastify__slideOutRight {
            0% {
                transform: translate3d(0, var(--y), 0)
            }

            to {
                visibility: hidden;
                transform: translate3d(110%, var(--y), 0)
            }
        }

        @keyframes Toastify__slideOutLeft {
            0% {
                transform: translate3d(0, var(--y), 0)
            }

            to {
                visibility: hidden;
                transform: translate3d(-110%, var(--y), 0)
            }
        }

        @keyframes Toastify__slideOutDown {
            0% {
                transform: translate3d(0, var(--y), 0)
            }

            to {
                visibility: hidden;
                transform: translate3d(0, 500px, 0)
            }
        }

        @keyframes Toastify__slideOutUp {
            0% {
                transform: translate3d(0, var(--y), 0)
            }

            to {
                visibility: hidden;
                transform: translate3d(0, -500px, 0)
            }
        }

        .Toastify__slide-enter--top-left,
        .Toastify__slide-enter--bottom-left {
            animation-name: Toastify__slideInLeft
        }

        .Toastify__slide-enter--top-right,
        .Toastify__slide-enter--bottom-right {
            animation-name: Toastify__slideInRight
        }

        .Toastify__slide-enter--top-center {
            animation-name: Toastify__slideInDown
        }

        .Toastify__slide-enter--bottom-center {
            animation-name: Toastify__slideInUp
        }

        .Toastify__slide-exit--top-left,
        .Toastify__slide-exit--bottom-left {
            animation-name: Toastify__slideOutLeft;
            animation-timing-function: ease-in;
            animation-duration: .3s
        }

        .Toastify__slide-exit--top-right,
        .Toastify__slide-exit--bottom-right {
            animation-name: Toastify__slideOutRight;
            animation-timing-function: ease-in;
            animation-duration: .3s
        }

        .Toastify__slide-exit--top-center {
            animation-name: Toastify__slideOutUp;
            animation-timing-function: ease-in;
            animation-duration: .3s
        }

        .Toastify__slide-exit--bottom-center {
            animation-name: Toastify__slideOutDown;
            animation-timing-function: ease-in;
            animation-duration: .3s
        }

        @keyframes Toastify__spin {
            0% {
                transform: rotate(0)
            }

            to {
                transform: rotate(360deg)
            }
        }
    </style>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:title" content="kiddyxstore">
    <meta property="og:description"
        content="ขายรหัสเกม VALORANT, ROV, FiveM, Discord, Steam, Rockstar ราคาถูก ปลอดภัย ส่งไว มีบริการปลดแบนเกมและ FiveM ติดต่อผ่าน Ticket ได้ทันที">
    <meta property="og:url" content="https://www.kiddyxstore.com/">
    <meta property="og:image" content="https://img2.pic.in.th/pic/logodiscordf124e71a99293428.png">
    <meta property="og:type" content="website">
    <title>Kiddy Store - Welcome</title>


    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link
        href="https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap"
        rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        /*! tailwindcss v4.1.16 | MIT License | https://tailwindcss.com */
        @layer properties;
        @layer theme, base, components, utilities;

        @layer theme {

            :root,
            :host {
                --font-sans: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
                    'Noto Color Emoji';
                --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
                    monospace;
                --color-green-300: oklch(87.1% 0.15 154.449);
                --color-cyan-400: oklch(78.9% 0.154 211.53);
                --color-blue-300: oklch(80.9% 0.105 251.813);
                --color-blue-400: oklch(70.7% 0.165 254.624);
                --color-blue-500: oklch(62.3% 0.214 259.815);
                --color-blue-600: oklch(54.6% 0.245 262.881);
                --color-purple-500: oklch(62.7% 0.265 303.9);
                --color-purple-600: oklch(55.8% 0.288 302.321);
                --color-purple-700: oklch(49.6% 0.265 301.924);
                --color-pink-400: oklch(71.8% 0.202 349.761);
                --color-pink-500: oklch(65.6% 0.241 354.308);
                --color-gray-300: oklch(87.2% 0.01 258.338);
                --color-gray-400: oklch(70.7% 0.022 261.325);
                --color-gray-900: oklch(21% 0.034 264.665);
                --color-black: #000;
                --color-white: #fff;
                --spacing: 0.25rem;
                --container-xs: 20rem;
                --container-6xl: 72rem;
                --container-7xl: 80rem;
                --text-xs: 0.75rem;
                --text-xs--line-height: calc(1 / 0.75);
                --text-sm: 0.875rem;
                --text-sm--line-height: calc(1.25 / 0.875);
                --text-lg: 1.125rem;
                --text-lg--line-height: calc(1.75 / 1.125);
                --text-2xl: 1.5rem;
                --text-2xl--line-height: calc(2 / 1.5);
                --text-3xl: 1.875rem;
                --text-3xl--line-height: calc(2.25 / 1.875);
                --text-4xl: 2.25rem;
                --text-4xl--line-height: calc(2.5 / 2.25);
                --text-5xl: 3rem;
                --text-5xl--line-height: 1;
                --font-weight-medium: 500;
                --font-weight-semibold: 600;
                --font-weight-bold: 700;
                --radius-sm: 0.25rem;
                --radius-lg: 0.5rem;
                --radius-2xl: 1rem;
                --animate-spin: spin 1s linear infinite;
                --animate-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                --blur-sm: 8px;
                --blur-md: 12px;
                --default-transition-duration: 150ms;
                --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                --default-font-family: var(--font-sans);
                --default-mono-font-family: var(--font-mono);
            }
        }

        @layer base {

            *,
            ::after,
            ::before,
            ::backdrop,
            ::file-selector-button {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                border: 0 solid;
            }

            html,
            :host {
                line-height: 1.5;
                -webkit-text-size-adjust: 100%;
                tab-size: 4;
                font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji');
                font-feature-settings: var(--default-font-feature-settings, normal);
                font-variation-settings: var(--default-font-variation-settings, normal);
                -webkit-tap-highlight-color: transparent;
            }

            hr {
                height: 0;
                color: inherit;
                border-top-width: 1px;
            }

            abbr:where([title]) {
                -webkit-text-decoration: underline dotted;
                text-decoration: underline dotted;
            }

            h1,
            h2,
            h3,
            h4,
            h5,
            h6 {
                font-size: inherit;
                font-weight: inherit;
            }

            a {
                color: inherit;
                -webkit-text-decoration: inherit;
                text-decoration: inherit;
            }

            b,
            strong {
                font-weight: bolder;
            }

            code,
            kbd,
            samp,
            pre {
                font-family: var(--default-mono-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
                font-feature-settings: var(--default-mono-font-feature-settings, normal);
                font-variation-settings: var(--default-mono-font-variation-settings, normal);
                font-size: 1em;
            }

            small {
                font-size: 80%;
            }

            sub,
            sup {
                font-size: 75%;
                line-height: 0;
                position: relative;
                vertical-align: baseline;
            }

            sub {
                bottom: -0.25em;
            }

            sup {
                top: -0.5em;
            }

            table {
                text-indent: 0;
                border-color: inherit;
                border-collapse: collapse;
            }

            :-moz-focusring {
                outline: auto;
            }

            progress {
                vertical-align: baseline;
            }

            summary {
                display: list-item;
            }

            ol,
            ul,
            menu {
                list-style: none;
            }

            img,
            svg,
            video,
            canvas,
            audio,
            iframe,
            embed,
            object {
                display: block;
                vertical-align: middle;
            }

            img,
            video {
                max-width: 100%;
                height: auto;
            }

            button,
            input,
            select,
            optgroup,
            textarea,
            ::file-selector-button {
                font: inherit;
                font-feature-settings: inherit;
                font-variation-settings: inherit;
                letter-spacing: inherit;
                color: inherit;
                border-radius: 0;
                background-color: transparent;
                opacity: 1;
            }

            :where(select:is([multiple], [size])) optgroup {
                font-weight: bolder;
            }

            :where(select:is([multiple], [size])) optgroup option {
                padding-inline-start: 20px;
            }

            ::file-selector-button {
                margin-inline-end: 4px;
            }

            ::placeholder {
                opacity: 1;
            }

            @supports (not (-webkit-appearance: -apple-pay-button)) or (contain-intrinsic-size: 1px) {
                ::placeholder {
                    color: currentcolor;

                    @supports (color: color-mix(in lab, red, red)) {
                        color: color-mix(in oklab, currentcolor 50%, transparent);
                    }
                }
            }

            textarea {
                resize: vertical;
            }

            ::-webkit-search-decoration {
                -webkit-appearance: none;
            }

            ::-webkit-date-and-time-value {
                min-height: 1lh;
                text-align: inherit;
            }

            ::-webkit-datetime-edit {
                display: inline-flex;
            }

            ::-webkit-datetime-edit-fields-wrapper {
                padding: 0;
            }

            ::-webkit-datetime-edit,
            ::-webkit-datetime-edit-year-field,
            ::-webkit-datetime-edit-month-field,
            ::-webkit-datetime-edit-day-field,
            ::-webkit-datetime-edit-hour-field,
            ::-webkit-datetime-edit-minute-field,
            ::-webkit-datetime-edit-second-field,
            ::-webkit-datetime-edit-millisecond-field,
            ::-webkit-datetime-edit-meridiem-field {
                padding-block: 0;
            }

            ::-webkit-calendar-picker-indicator {
                line-height: 1;
            }

            :-moz-ui-invalid {
                box-shadow: none;
            }

            button,
            input:where([type='button'], [type='reset'], [type='submit']),
            ::file-selector-button {
                appearance: button;
            }

            ::-webkit-inner-spin-button,
            ::-webkit-outer-spin-button {
                height: auto;
            }

            [hidden]:where(:not([hidden='until-found'])) {
                display: none !important;
            }
        }

        @layer utilities {
            .invisible {
                visibility: hidden;
            }

            .absolute {
                position: absolute;
            }

            .relative {
                position: relative;
            }

            .inset-0 {
                inset: calc(var(--spacing) * 0);
            }

            .top-0 {
                top: calc(var(--spacing) * 0);
            }

            .top-1\/2 {
                top: calc(1/2 * 100%);
            }

            .top-2 {
                top: calc(var(--spacing) * 2);
            }

            .right-0 {
                right: calc(var(--spacing) * 0);
            }

            .right-2 {
                right: calc(var(--spacing) * 2);
            }

            .left-0 {
                left: calc(var(--spacing) * 0);
            }

            .left-2 {
                left: calc(var(--spacing) * 2);
            }

            .z-10 {
                z-index: 10;
            }

            .z-50 {
                z-index: 50;
            }

            .container {
                width: 100%;

                @media (width >=40rem) {
                    max-width: 40rem;
                }

                @media (width >=48rem) {
                    max-width: 48rem;
                }

                @media (width >=64rem) {
                    max-width: 64rem;
                }

                @media (width >=80rem) {
                    max-width: 80rem;
                }

                @media (width >=96rem) {
                    max-width: 96rem;
                }
            }

            .mx-auto {
                margin-inline: auto;
            }

            .my-1 {
                margin-block: calc(var(--spacing) * 1);
            }

            .mt-2 {
                margin-top: calc(var(--spacing) * 2);
            }

            .mt-16 {
                margin-top: calc(var(--spacing) * 16);
            }

            .mr-2 {
                margin-right: calc(var(--spacing) * 2);
            }

            .mr-4 {
                margin-right: calc(var(--spacing) * 4);
            }

            .mb-2 {
                margin-bottom: calc(var(--spacing) * 2);
            }

            .mb-3 {
                margin-bottom: calc(var(--spacing) * 3);
            }

            .mb-4 {
                margin-bottom: calc(var(--spacing) * 4);
            }

            .mb-6 {
                margin-bottom: calc(var(--spacing) * 6);
            }

            .mb-8 {
                margin-bottom: calc(var(--spacing) * 8);
            }

            .mb-12 {
                margin-bottom: calc(var(--spacing) * 12);
            }

            .ml-4 {
                margin-left: calc(var(--spacing) * 4);
            }

            .flex {
                display: flex;
            }

            .grid {
                display: grid;
            }

            .hidden {
                display: none;
            }

            .inline-block {
                display: inline-block;
            }

            .h-1 {
                height: calc(var(--spacing) * 1);
            }

            .h-2 {
                height: calc(var(--spacing) * 2);
            }

            .h-2\.5 {
                height: calc(var(--spacing) * 2.5);
            }

            .h-3 {
                height: calc(var(--spacing) * 3);
            }

            .h-5 {
                height: calc(var(--spacing) * 5);
            }

            .h-6 {
                height: calc(var(--spacing) * 6);
            }

            .h-8 {
                height: calc(var(--spacing) * 8);
            }

            .h-10 {
                height: calc(var(--spacing) * 10);
            }

            .h-12 {
                height: calc(var(--spacing) * 12);
            }

            .h-32 {
                height: calc(var(--spacing) * 32);
            }

            .h-48 {
                height: calc(var(--spacing) * 48);
            }

            .h-56 {
                height: calc(var(--spacing) * 56);
            }

            .h-full {
                height: 100%;
            }

            .min-h-80 {
                min-height: calc(var(--spacing) * 80);
            }

            .min-h-screen {
                min-height: 100vh;
            }

            .w-0 {
                width: calc(var(--spacing) * 0);
            }

            .w-2 {
                width: calc(var(--spacing) * 2);
            }

            .w-2\.5 {
                width: calc(var(--spacing) * 2.5);
            }

            .w-3 {
                width: calc(var(--spacing) * 3);
            }

            .w-5 {
                width: calc(var(--spacing) * 5);
            }

            .w-6 {
                width: calc(var(--spacing) * 6);
            }

            .w-8 {
                width: calc(var(--spacing) * 8);
            }

            .w-10 {
                width: calc(var(--spacing) * 10);
            }

            .w-12 {
                width: calc(var(--spacing) * 12);
            }

            .w-48 {
                width: calc(var(--spacing) * 48);
            }

            .w-52 {
                width: calc(var(--spacing) * 52);
            }

            .w-full {
                width: 100%;
            }

            .max-w-6xl {
                max-width: var(--container-6xl);
            }

            .max-w-7xl {
                max-width: var(--container-7xl);
            }

            .max-w-xs {
                max-width: var(--container-xs);
            }

            .flex-shrink-0 {
                flex-shrink: 0;
            }

            .flex-grow {
                flex-grow: 1;
            }

            .translate-x-\[-100\%\] {
                --tw-translate-x: -100%;
                translate: var(--tw-translate-x) var(--tw-translate-y);
            }

            .-translate-y-1\/2 {
                --tw-translate-y: calc(calc(1/2 * 100%) * -1);
                translate: var(--tw-translate-x) var(--tw-translate-y);
            }

            .translate-y-8 {
                --tw-translate-y: calc(var(--spacing) * 8);
                translate: var(--tw-translate-x) var(--tw-translate-y);
            }

            .scale-95 {
                --tw-scale-x: 95%;
                --tw-scale-y: 95%;
                --tw-scale-z: 95%;
                scale: var(--tw-scale-x) var(--tw-scale-y);
            }

            .-skew-x-12 {
                --tw-skew-x: skewX(calc(12deg * -1));
                transform: var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, );
            }

            .transform {
                transform: var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, );
            }

            .animate-pulse {
                animation: var(--animate-pulse);
            }

            .animate-spin {
                animation: var(--animate-spin);
            }

            .cursor-pointer {
                cursor: pointer;
            }

            .grid-cols-2 {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .flex-col {
                flex-direction: column;
            }

            .flex-wrap {
                flex-wrap: wrap;
            }

            .items-center {
                align-items: center;
            }

            .justify-between {
                justify-content: space-between;
            }

            .justify-center {
                justify-content: center;
            }

            .gap-6 {
                gap: calc(var(--spacing) * 6);
            }

            .gap-8 {
                gap: calc(var(--spacing) * 8);
            }

            .space-y-4 {
                :where(& > :not(:last-child)) {
                    --tw-space-y-reverse: 0;
                    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
                    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
                }
            }

            .space-x-1 {
                :where(& > :not(:last-child)) {
                    --tw-space-x-reverse: 0;
                    margin-inline-start: calc(calc(var(--spacing) * 1) * var(--tw-space-x-reverse));
                    margin-inline-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-x-reverse)));
                }
            }

            .space-x-2 {
                :where(& > :not(:last-child)) {
                    --tw-space-x-reverse: 0;
                    margin-inline-start: calc(calc(var(--spacing) * 2) * var(--tw-space-x-reverse));
                    margin-inline-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-x-reverse)));
                }
            }

            .space-x-3 {
                :where(& > :not(:last-child)) {
                    --tw-space-x-reverse: 0;
                    margin-inline-start: calc(calc(var(--spacing) * 3) * var(--tw-space-x-reverse));
                    margin-inline-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-x-reverse)));
                }
            }

            .space-x-4 {
                :where(& > :not(:last-child)) {
                    --tw-space-x-reverse: 0;
                    margin-inline-start: calc(calc(var(--spacing) * 4) * var(--tw-space-x-reverse));
                    margin-inline-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-x-reverse)));
                }
            }

            .truncate {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .overflow-hidden {
                overflow: hidden;
            }

            .rounded {
                border-radius: 0.25rem;
            }

            .rounded-2xl {
                border-radius: var(--radius-2xl);
            }

            .rounded-full {
                border-radius: calc(infinity * 1px);
            }

            .rounded-lg {
                border-radius: var(--radius-lg);
            }

            .rounded-sm {
                border-radius: var(--radius-sm);
            }

            .border {
                border-style: var(--tw-border-style);
                border-width: 1px;
            }

            .border-t {
                border-top-style: var(--tw-border-style);
                border-top-width: 1px;
            }

            .border-b {
                border-bottom-style: var(--tw-border-style);
                border-bottom-width: 1px;
            }

            .border-b-2 {
                border-bottom-style: var(--tw-border-style);
                border-bottom-width: 2px;
            }

            .border-blue-500 {
                border-color: var(--color-blue-500);
            }

            .border-white\/10 {
                border-color: color-mix(in srgb, #fff 10%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    border-color: color-mix(in oklab, var(--color-white) 10%, transparent);
                }
            }

            .border-white\/20 {
                border-color: color-mix(in srgb, #fff 20%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    border-color: color-mix(in oklab, var(--color-white) 20%, transparent);
                }
            }

            .bg-black\/90 {
                background-color: color-mix(in srgb, #000 90%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    background-color: color-mix(in oklab, var(--color-black) 90%, transparent);
                }
            }

            .bg-blue-500\/10 {
                background-color: color-mix(in srgb, oklch(62.3% 0.214 259.815) 10%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    background-color: color-mix(in oklab, var(--color-blue-500) 10%, transparent);
                }
            }

            .bg-blue-500\/20 {
                background-color: color-mix(in srgb, oklch(62.3% 0.214 259.815) 20%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    background-color: color-mix(in oklab, var(--color-blue-500) 20%, transparent);
                }
            }

            .bg-green-300 {
                background-color: var(--color-green-300);
            }

            .bg-white\/5 {
                background-color: color-mix(in srgb, #fff 5%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    background-color: color-mix(in oklab, var(--color-white) 5%, transparent);
                }
            }

            .bg-white\/10 {
                background-color: color-mix(in srgb, #fff 10%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    background-color: color-mix(in oklab, var(--color-white) 10%, transparent);
                }
            }

            .bg-white\/20 {
                background-color: color-mix(in srgb, #fff 20%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    background-color: color-mix(in oklab, var(--color-white) 20%, transparent);
                }
            }

            .bg-gradient-to-br {
                --tw-gradient-position: to bottom right in oklab;
                background-image: linear-gradient(var(--tw-gradient-stops));
            }

            .bg-gradient-to-r {
                --tw-gradient-position: to right in oklab;
                background-image: linear-gradient(var(--tw-gradient-stops));
            }

            .bg-gradient-to-t {
                --tw-gradient-position: to top in oklab;
                background-image: linear-gradient(var(--tw-gradient-stops));
            }

            .from-black\/80 {
                --tw-gradient-from: color-mix(in srgb, #000 80%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    --tw-gradient-from: color-mix(in oklab, var(--color-black) 80%, transparent);
                }

                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .from-blue-500 {
                --tw-gradient-from: var(--color-blue-500);
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .from-gray-900 {
                --tw-gradient-from: var(--color-gray-900);
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .from-transparent {
                --tw-gradient-from: transparent;
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .via-black {
                --tw-gradient-via: var(--color-black);
                --tw-gradient-via-stops: var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position);
                --tw-gradient-stops: var(--tw-gradient-via-stops);
            }

            .via-black\/20 {
                --tw-gradient-via: color-mix(in srgb, #000 20%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    --tw-gradient-via: color-mix(in oklab, var(--color-black) 20%, transparent);
                }

                --tw-gradient-via-stops: var(--tw-gradient-position),
                var(--tw-gradient-from) var(--tw-gradient-from-position),
                var(--tw-gradient-via) var(--tw-gradient-via-position),
                var(--tw-gradient-to) var(--tw-gradient-to-position);
                --tw-gradient-stops: var(--tw-gradient-via-stops);
            }

            .via-blue-400 {
                --tw-gradient-via: var(--color-blue-400);
                --tw-gradient-via-stops: var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position);
                --tw-gradient-stops: var(--tw-gradient-via-stops);
            }

            .via-pink-500 {
                --tw-gradient-via: var(--color-pink-500);
                --tw-gradient-via-stops: var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position);
                --tw-gradient-stops: var(--tw-gradient-via-stops);
            }

            .via-purple-500 {
                --tw-gradient-via: var(--color-purple-500);
                --tw-gradient-via-stops: var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position);
                --tw-gradient-stops: var(--tw-gradient-via-stops);
            }

            .via-white\/20 {
                --tw-gradient-via: color-mix(in srgb, #fff 20%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    --tw-gradient-via: color-mix(in oklab, var(--color-white) 20%, transparent);
                }

                --tw-gradient-via-stops: var(--tw-gradient-position),
                var(--tw-gradient-from) var(--tw-gradient-from-position),
                var(--tw-gradient-via) var(--tw-gradient-via-position),
                var(--tw-gradient-to) var(--tw-gradient-to-position);
                --tw-gradient-stops: var(--tw-gradient-via-stops);
            }

            .to-cyan-400 {
                --tw-gradient-to: var(--color-cyan-400);
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .to-gray-900 {
                --tw-gradient-to: var(--color-gray-900);
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .to-purple-600 {
                --tw-gradient-to: var(--color-purple-600);
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .to-transparent {
                --tw-gradient-to: transparent;
                --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
            }

            .bg-clip-text {
                background-clip: text;
            }

            .object-contain {
                object-fit: contain;
            }

            .object-cover {
                object-fit: cover;
            }

            .p-3 {
                padding: calc(var(--spacing) * 3);
            }

            .p-4 {
                padding: calc(var(--spacing) * 4);
            }

            .px-3 {
                padding-inline: calc(var(--spacing) * 3);
            }

            .px-4 {
                padding-inline: calc(var(--spacing) * 4);
            }

            .px-6 {
                padding-inline: calc(var(--spacing) * 6);
            }

            .py-1 {
                padding-block: calc(var(--spacing) * 1);
            }

            .py-1\.5 {
                padding-block: calc(var(--spacing) * 1.5);
            }

            .py-2 {
                padding-block: calc(var(--spacing) * 2);
            }

            .py-3 {
                padding-block: calc(var(--spacing) * 3);
            }

            .py-8 {
                padding-block: calc(var(--spacing) * 8);
            }

            .py-12 {
                padding-block: calc(var(--spacing) * 12);
            }

            .pr-8 {
                padding-right: calc(var(--spacing) * 8);
            }

            .text-center {
                text-align: center;
            }

            .text-2xl {
                font-size: var(--text-2xl);
                line-height: var(--tw-leading, var(--text-2xl--line-height));
            }

            .text-3xl {
                font-size: var(--text-3xl);
                line-height: var(--tw-leading, var(--text-3xl--line-height));
            }

            .text-lg {
                font-size: var(--text-lg);
                line-height: var(--tw-leading, var(--text-lg--line-height));
            }

            .text-sm {
                font-size: var(--text-sm);
                line-height: var(--tw-leading, var(--text-sm--line-height));
            }

            .text-xs {
                font-size: var(--text-xs);
                line-height: var(--tw-leading, var(--text-xs--line-height));
            }

            .font-bold {
                --tw-font-weight: var(--font-weight-bold);
                font-weight: var(--font-weight-bold);
            }

            .font-medium {
                --tw-font-weight: var(--font-weight-medium);
                font-weight: var(--font-weight-medium);
            }

            .font-semibold {
                --tw-font-weight: var(--font-weight-semibold);
                font-weight: var(--font-weight-semibold);
            }

            .text-blue-400 {
                color: var(--color-blue-400);
            }

            .text-gray-400 {
                color: var(--color-gray-400);
            }

            .text-transparent {
                color: transparent;
            }

            .text-white {
                color: var(--color-white);
            }

            .text-white\/60 {
                color: color-mix(in srgb, #fff 60%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    color: color-mix(in oklab, var(--color-white) 60%, transparent);
                }
            }

            .text-white\/70 {
                color: color-mix(in srgb, #fff 70%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    color: color-mix(in oklab, var(--color-white) 70%, transparent);
                }
            }

            .text-white\/80 {
                color: color-mix(in srgb, #fff 80%, transparent);

                @supports (color: color-mix(in lab, red, red)) {
                    color: color-mix(in oklab, var(--color-white) 80%, transparent);
                }
            }

            .placeholder-white\/50 {
                &::placeholder {
                    color: color-mix(in srgb, #fff 50%, transparent);

                    @supports (color: color-mix(in lab, red, red)) {
                        color: color-mix(in oklab, var(--color-white) 50%, transparent);
                    }
                }
            }

            .opacity-0 {
                opacity: 0%;
            }

            .shadow-2xl {
                --tw-shadow: 0 25px 50px -12px var(--tw-shadow-color, rgb(0 0 0 / 0.25));
                box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
            }

            .shadow-lg {
                --tw-shadow: 0 10px 15px -3px var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 4px 6px -4px var(--tw-shadow-color, rgb(0 0 0 / 0.1));
                box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
            }

            .blur {
                --tw-blur: blur(8px);
                filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );
            }

            .backdrop-blur-md {
                --tw-backdrop-blur: blur(var(--blur-md));
                -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
                backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
            }

            .backdrop-blur-sm {
                --tw-backdrop-blur: blur(var(--blur-sm));
                -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
                backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
            }

            .transition-all {
                transition-property: all;
                transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
                transition-duration: var(--tw-duration, var(--default-transition-duration));
            }

            .transition-colors {
                transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to;
                transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
                transition-duration: var(--tw-duration, var(--default-transition-duration));
            }

            .transition-opacity {
                transition-property: opacity;
                transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
                transition-duration: var(--tw-duration, var(--default-transition-duration));
            }

            .transition-transform {
                transition-property: transform, translate, scale, rotate;
                transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
                transition-duration: var(--tw-duration, var(--default-transition-duration));
            }

            .duration-300 {
                --tw-duration: 300ms;
                transition-duration: 300ms;
            }

            .duration-500 {
                --tw-duration: 500ms;
                transition-duration: 500ms;
            }

            .duration-700 {
                --tw-duration: 700ms;
                transition-duration: 700ms;
            }

            .duration-1000 {
                --tw-duration: 1000ms;
                transition-duration: 1000ms;
            }

            .group-hover\:visible {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        visibility: visible;
                    }
                }
            }

            .group-hover\:w-full {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        width: 100%;
                    }
                }
            }

            .group-hover\:translate-x-\[100\%\] {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        --tw-translate-x: 100%;
                        translate: var(--tw-translate-x) var(--tw-translate-y);
                    }
                }
            }

            .group-hover\:scale-110 {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        --tw-scale-x: 110%;
                        --tw-scale-y: 110%;
                        --tw-scale-z: 110%;
                        scale: var(--tw-scale-x) var(--tw-scale-y);
                    }
                }
            }

            .group-hover\:bg-white\/10 {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        background-color: color-mix(in srgb, #fff 10%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            background-color: color-mix(in oklab, var(--color-white) 10%, transparent);
                        }
                    }
                }
            }

            .group-hover\:text-blue-300 {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        color: var(--color-blue-300);
                    }
                }
            }

            .group-hover\:text-gray-300 {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        color: var(--color-gray-300);
                    }
                }
            }

            .group-hover\:opacity-100 {
                &:is(:where(.group):hover *) {
                    @media (hover: hover) {
                        opacity: 100%;
                    }
                }
            }

            .hover\:-translate-y-2 {
                &:hover {
                    @media (hover: hover) {
                        --tw-translate-y: calc(var(--spacing) * -2);
                        translate: var(--tw-translate-x) var(--tw-translate-y);
                    }
                }
            }

            .hover\:scale-105 {
                &:hover {
                    @media (hover: hover) {
                        --tw-scale-x: 105%;
                        --tw-scale-y: 105%;
                        --tw-scale-z: 105%;
                        scale: var(--tw-scale-x) var(--tw-scale-y);
                    }
                }
            }

            .hover\:border-blue-500\/20 {
                &:hover {
                    @media (hover: hover) {
                        border-color: color-mix(in srgb, oklch(62.3% 0.214 259.815) 20%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            border-color: color-mix(in oklab, var(--color-blue-500) 20%, transparent);
                        }
                    }
                }
            }

            .hover\:border-blue-500\/50 {
                &:hover {
                    @media (hover: hover) {
                        border-color: color-mix(in srgb, oklch(62.3% 0.214 259.815) 50%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            border-color: color-mix(in oklab, var(--color-blue-500) 50%, transparent);
                        }
                    }
                }
            }

            .hover\:border-white\/40 {
                &:hover {
                    @media (hover: hover) {
                        border-color: color-mix(in srgb, #fff 40%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            border-color: color-mix(in oklab, var(--color-white) 40%, transparent);
                        }
                    }
                }
            }

            .hover\:bg-white\/10 {
                &:hover {
                    @media (hover: hover) {
                        background-color: color-mix(in srgb, #fff 10%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            background-color: color-mix(in oklab, var(--color-white) 10%, transparent);
                        }
                    }
                }
            }

            .hover\:bg-white\/20 {
                &:hover {
                    @media (hover: hover) {
                        background-color: color-mix(in srgb, #fff 20%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            background-color: color-mix(in oklab, var(--color-white) 20%, transparent);
                        }
                    }
                }
            }

            .hover\:from-blue-600 {
                &:hover {
                    @media (hover: hover) {
                        --tw-gradient-from: var(--color-blue-600);
                        --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
                    }
                }
            }

            .hover\:to-purple-700 {
                &:hover {
                    @media (hover: hover) {
                        --tw-gradient-to: var(--color-purple-700);
                        --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
                    }
                }
            }

            .hover\:text-white {
                &:hover {
                    @media (hover: hover) {
                        color: var(--color-white);
                    }
                }
            }

            .hover\:shadow-blue-400\/50 {
                &:hover {
                    @media (hover: hover) {
                        --tw-shadow-color: color-mix(in srgb, oklch(70.7% 0.165 254.624) 50%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--color-blue-400) 50%, transparent) var(--tw-shadow-alpha), transparent);
                        }
                    }
                }
            }

            .hover\:shadow-blue-500\/20 {
                &:hover {
                    @media (hover: hover) {
                        --tw-shadow-color: color-mix(in srgb, oklch(62.3% 0.214 259.815) 20%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--color-blue-500) 20%, transparent) var(--tw-shadow-alpha), transparent);
                        }
                    }
                }
            }

            .hover\:shadow-blue-500\/25 {
                &:hover {
                    @media (hover: hover) {
                        --tw-shadow-color: color-mix(in srgb, oklch(62.3% 0.214 259.815) 25%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--color-blue-500) 25%, transparent) var(--tw-shadow-alpha), transparent);
                        }
                    }
                }
            }

            .hover\:shadow-pink-400\/50 {
                &:hover {
                    @media (hover: hover) {
                        --tw-shadow-color: color-mix(in srgb, oklch(71.8% 0.202 349.761) 50%, transparent);

                        @supports (color: color-mix(in lab, red, red)) {
                            --tw-shadow-color: color-mix(in oklab, color-mix(in oklab, var(--color-pink-400) 50%, transparent) var(--tw-shadow-alpha), transparent);
                        }
                    }
                }
            }

            .focus\:border-blue-500 {
                &:focus {
                    border-color: var(--color-blue-500);
                }
            }

            .focus\:bg-white\/20 {
                &:focus {
                    background-color: color-mix(in srgb, #fff 20%, transparent);

                    @supports (color: color-mix(in lab, red, red)) {
                        background-color: color-mix(in oklab, var(--color-white) 20%, transparent);
                    }
                }
            }

            .focus\:outline-none {
                &:focus {
                    --tw-outline-style: none;
                    outline-style: none;
                }
            }

            .sm\:w-80 {
                @media (width >=40rem) {
                    width: calc(var(--spacing) * 80);
                }
            }

            .md\:flex {
                @media (width >=48rem) {
                    display: flex;
                }
            }

            .md\:hidden {
                @media (width >=48rem) {
                    display: none;
                }
            }

            .md\:grid-cols-3 {
                @media (width >=48rem) {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
            }

            .md\:text-4xl {
                @media (width >=48rem) {
                    font-size: var(--text-4xl);
                    line-height: var(--tw-leading, var(--text-4xl--line-height));
                }
            }

            .md\:text-5xl {
                @media (width >=48rem) {
                    font-size: var(--text-5xl);
                    line-height: var(--tw-leading, var(--text-5xl--line-height));
                }
            }

            .lg\:grid-cols-4 {
                @media (width >=64rem) {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                }
            }

            .xl\:grid-cols-6 {
                @media (width >=80rem) {
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                }
            }
        }

        @property --tw-translate-x {
            syntax: "*";
            inherits: false;
            initial-value: 0;
        }

        @property --tw-translate-y {
            syntax: "*";
            inherits: false;
            initial-value: 0;
        }

        @property --tw-translate-z {
            syntax: "*";
            inherits: false;
            initial-value: 0;
        }

        @property --tw-scale-x {
            syntax: "*";
            inherits: false;
            initial-value: 1;
        }

        @property --tw-scale-y {
            syntax: "*";
            inherits: false;
            initial-value: 1;
        }

        @property --tw-scale-z {
            syntax: "*";
            inherits: false;
            initial-value: 1;
        }

        @property --tw-rotate-x {
            syntax: "*";
            inherits: false;
        }

        @property --tw-rotate-y {
            syntax: "*";
            inherits: false;
        }

        @property --tw-rotate-z {
            syntax: "*";
            inherits: false;
        }

        @property --tw-skew-x {
            syntax: "*";
            inherits: false;
        }

        @property --tw-skew-y {
            syntax: "*";
            inherits: false;
        }

        @property --tw-space-y-reverse {
            syntax: "*";
            inherits: false;
            initial-value: 0;
        }

        @property --tw-space-x-reverse {
            syntax: "*";
            inherits: false;
            initial-value: 0;
        }

        @property --tw-border-style {
            syntax: "*";
            inherits: false;
            initial-value: solid;
        }

        @property --tw-gradient-position {
            syntax: "*";
            inherits: false;
        }

        @property --tw-gradient-from {
            syntax: "<color>";
            inherits: false;
            initial-value: #0000;
        }

        @property --tw-gradient-via {
            syntax: "<color>";
            inherits: false;
            initial-value: #0000;
        }

        @property --tw-gradient-to {
            syntax: "<color>";
            inherits: false;
            initial-value: #0000;
        }

        @property --tw-gradient-stops {
            syntax: "*";
            inherits: false;
        }

        @property --tw-gradient-via-stops {
            syntax: "*";
            inherits: false;
        }

        @property --tw-gradient-from-position {
            syntax: "<length-percentage>";
            inherits: false;
            initial-value: 0%;
        }

        @property --tw-gradient-via-position {
            syntax: "<length-percentage>";
            inherits: false;
            initial-value: 50%;
        }

        @property --tw-gradient-to-position {
            syntax: "<length-percentage>";
            inherits: false;
            initial-value: 100%;
        }

        @property --tw-font-weight {
            syntax: "*";
            inherits: false;
        }

        @property --tw-shadow {
            syntax: "*";
            inherits: false;
            initial-value: 0 0 #0000;
        }

        @property --tw-shadow-color {
            syntax: "*";
            inherits: false;
        }

        @property --tw-shadow-alpha {
            syntax: "<percentage>";
            inherits: false;
            initial-value: 100%;
        }

        @property --tw-inset-shadow {
            syntax: "*";
            inherits: false;
            initial-value: 0 0 #0000;
        }

        @property --tw-inset-shadow-color {
            syntax: "*";
            inherits: false;
        }

        @property --tw-inset-shadow-alpha {
            syntax: "<percentage>";
            inherits: false;
            initial-value: 100%;
        }

        @property --tw-ring-color {
            syntax: "*";
            inherits: false;
        }

        @property --tw-ring-shadow {
            syntax: "*";
            inherits: false;
            initial-value: 0 0 #0000;
        }

        @property --tw-inset-ring-color {
            syntax: "*";
            inherits: false;
        }

        @property --tw-inset-ring-shadow {
            syntax: "*";
            inherits: false;
            initial-value: 0 0 #0000;
        }

        @property --tw-ring-inset {
            syntax: "*";
            inherits: false;
        }

        @property --tw-ring-offset-width {
            syntax: "<length>";
            inherits: false;
            initial-value: 0px;
        }

        @property --tw-ring-offset-color {
            syntax: "*";
            inherits: false;
            initial-value: #fff;
        }

        @property --tw-ring-offset-shadow {
            syntax: "*";
            inherits: false;
            initial-value: 0 0 #0000;
        }

        @property --tw-blur {
            syntax: "*";
            inherits: false;
        }

        @property --tw-brightness {
            syntax: "*";
            inherits: false;
        }

        @property --tw-contrast {
            syntax: "*";
            inherits: false;
        }

        @property --tw-grayscale {
            syntax: "*";
            inherits: false;
        }

        @property --tw-hue-rotate {
            syntax: "*";
            inherits: false;
        }

        @property --tw-invert {
            syntax: "*";
            inherits: false;
        }

        @property --tw-opacity {
            syntax: "*";
            inherits: false;
        }

        @property --tw-saturate {
            syntax: "*";
            inherits: false;
        }

        @property --tw-sepia {
            syntax: "*";
            inherits: false;
        }

        @property --tw-drop-shadow {
            syntax: "*";
            inherits: false;
        }

        @property --tw-drop-shadow-color {
            syntax: "*";
            inherits: false;
        }

        @property --tw-drop-shadow-alpha {
            syntax: "<percentage>";
            inherits: false;
            initial-value: 100%;
        }

        @property --tw-drop-shadow-size {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-blur {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-brightness {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-contrast {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-grayscale {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-hue-rotate {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-invert {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-opacity {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-saturate {
            syntax: "*";
            inherits: false;
        }

        @property --tw-backdrop-sepia {
            syntax: "*";
            inherits: false;
        }

        @property --tw-duration {
            syntax: "*";
            inherits: false;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        @keyframes pulse {
            50% {
                opacity: 0.5;
            }
        }

        @layer properties {
            @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) {

                *,
                ::before,
                ::after,
                ::backdrop {
                    --tw-translate-x: 0;
                    --tw-translate-y: 0;
                    --tw-translate-z: 0;
                    --tw-scale-x: 1;
                    --tw-scale-y: 1;
                    --tw-scale-z: 1;
                    --tw-rotate-x: initial;
                    --tw-rotate-y: initial;
                    --tw-rotate-z: initial;
                    --tw-skew-x: initial;
                    --tw-skew-y: initial;
                    --tw-space-y-reverse: 0;
                    --tw-space-x-reverse: 0;
                    --tw-border-style: solid;
                    --tw-gradient-position: initial;
                    --tw-gradient-from: #0000;
                    --tw-gradient-via: #0000;
                    --tw-gradient-to: #0000;
                    --tw-gradient-stops: initial;
                    --tw-gradient-via-stops: initial;
                    --tw-gradient-from-position: 0%;
                    --tw-gradient-via-position: 50%;
                    --tw-gradient-to-position: 100%;
                    --tw-font-weight: initial;
                    --tw-shadow: 0 0 #0000;
                    --tw-shadow-color: initial;
                    --tw-shadow-alpha: 100%;
                    --tw-inset-shadow: 0 0 #0000;
                    --tw-inset-shadow-color: initial;
                    --tw-inset-shadow-alpha: 100%;
                    --tw-ring-color: initial;
                    --tw-ring-shadow: 0 0 #0000;
                    --tw-inset-ring-color: initial;
                    --tw-inset-ring-shadow: 0 0 #0000;
                    --tw-ring-inset: initial;
                    --tw-ring-offset-width: 0px;
                    --tw-ring-offset-color: #fff;
                    --tw-ring-offset-shadow: 0 0 #0000;
                    --tw-blur: initial;
                    --tw-brightness: initial;
                    --tw-contrast: initial;
                    --tw-grayscale: initial;
                    --tw-hue-rotate: initial;
                    --tw-invert: initial;
                    --tw-opacity: initial;
                    --tw-saturate: initial;
                    --tw-sepia: initial;
                    --tw-drop-shadow: initial;
                    --tw-drop-shadow-color: initial;
                    --tw-drop-shadow-alpha: 100%;
                    --tw-drop-shadow-size: initial;
                    --tw-backdrop-blur: initial;
                    --tw-backdrop-brightness: initial;
                    --tw-backdrop-contrast: initial;
                    --tw-backdrop-grayscale: initial;
                    --tw-backdrop-hue-rotate: initial;
                    --tw-backdrop-invert: initial;
                    --tw-backdrop-opacity: initial;
                    --tw-backdrop-saturate: initial;
                    --tw-backdrop-sepia: initial;
                    --tw-duration: initial;
                }
            }
        }
    </style>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet" type="text/css">





    <style>
        @keyframes fade-in {
            from {
                opacity: 0;
            }

            to {
                opacity: 1;
            }
        }

        @keyframes fade-in-up {
            from {
                opacity: 0;
                transform: translateY(30px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes float {

            0%,
            100% {
                transform: translateY(0px);
            }

            50% {
                transform: translateY(-10px);
            }
        }

        @keyframes spin-slow {
            from {
                transform: rotate(0deg);
            }

            to {
                transform: rotate(360deg);
            }
        }

        .animate-fade-in {
            animation: fade-in 2s ease-in-out;
        }

        .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out forwards;
            opacity: 0;
        }

        .animate-float {
            animation: float 3s ease-in-out infinite;
        }

        .animate-spin-slow {
            animation: spin-slow 4s linear infinite;
        }
    </style>
    <script type="module" crossorigin="" src="/assets/index-DItquVOC.js"></script>
    <link rel="stylesheet" crossorigin="" href="/assets/index-BpfqqNBu.css">
    <style>
        :root {
            --swal2-outline: 0 0 0 3px rgba(100, 150, 200, 0.5);
            --swal2-container-padding: 0.625em;
            --swal2-backdrop: rgba(0, 0, 0, 0.4);
            --swal2-backdrop-transition: background-color 0.1s;
            --swal2-width: 32em;
            --swal2-padding: 0 0 1.25em;
            --swal2-border: none;
            --swal2-border-radius: 0.3125rem;
            --swal2-background: white;
            --swal2-color: #545454;
            --swal2-show-animation: swal2-show 0.3s;
            --swal2-hide-animation: swal2-hide 0.15s forwards;
            --swal2-icon-zoom: 1;
            --swal2-icon-animations: true;
            --swal2-title-padding: 0.8em 1em 0;
            --swal2-html-container-padding: 1em 1.6em 0.3em;
            --swal2-input-border: 1px solid #d9d9d9;
            --swal2-input-border-radius: 0.1875em;
            --swal2-input-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px transparent;
            --swal2-input-background: transparent;
            --swal2-input-transition: border-color 0.2s, box-shadow 0.2s;
            --swal2-input-hover-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px transparent;
            --swal2-input-focus-border: 1px solid #b4dbed;
            --swal2-input-focus-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px $swal2-outline-color;
            --swal2-progress-step-background: #add8e6;
            --swal2-validation-message-background: #f0f0f0;
            --swal2-validation-message-color: #666;
            --swal2-footer-border-color: #eee;
            --swal2-footer-background: transparent;
            --swal2-footer-color: inherit;
            --swal2-timer-progress-bar-background: rgba(0, 0, 0, 0.3);
            --swal2-close-button-position: initial;
            --swal2-close-button-inset: auto;
            --swal2-close-button-font-size: 2.5em;
            --swal2-close-button-color: #ccc;
            --swal2-close-button-transition: color 0.2s, box-shadow 0.2s;
            --swal2-close-button-outline: initial;
            --swal2-close-button-box-shadow: inset 0 0 0 3px transparent;
            --swal2-close-button-focus-box-shadow: inset var(--swal2-outline);
            --swal2-close-button-hover-transform: none;
            --swal2-actions-justify-content: center;
            --swal2-actions-width: auto;
            --swal2-actions-margin: 1.25em auto 0;
            --swal2-actions-padding: 0;
            --swal2-actions-border-radius: 0;
            --swal2-actions-background: transparent;
            --swal2-action-button-transition: background-color 0.2s, box-shadow 0.2s;
            --swal2-action-button-hover: black 10%;
            --swal2-action-button-active: black 10%;
            --swal2-confirm-button-box-shadow: none;
            --swal2-confirm-button-border-radius: 0.25em;
            --swal2-confirm-button-background-color: #7066e0;
            --swal2-confirm-button-color: #fff;
            --swal2-deny-button-box-shadow: none;
            --swal2-deny-button-border-radius: 0.25em;
            --swal2-deny-button-background-color: #dc3741;
            --swal2-deny-button-color: #fff;
            --swal2-cancel-button-box-shadow: none;
            --swal2-cancel-button-border-radius: 0.25em;
            --swal2-cancel-button-background-color: #6e7881;
            --swal2-cancel-button-color: #fff;
            --swal2-toast-show-animation: swal2-toast-show 0.5s;
            --swal2-toast-hide-animation: swal2-toast-hide 0.1s forwards;
            --swal2-toast-border: none;
            --swal2-toast-box-shadow: 0 0 1px hsl(0deg 0% 0% / 0.075), 0 1px 2px hsl(0deg 0% 0% / 0.075), 1px 2px 4px hsl(0deg 0% 0% / 0.075), 1px 3px 8px hsl(0deg 0% 0% / 0.075), 2px 4px 16px hsl(0deg 0% 0% / 0.075)
        }

        [data-swal2-theme=dark] {
            --swal2-dark-theme-black: #19191a;
            --swal2-dark-theme-white: #e1e1e1;
            --swal2-background: var(--swal2-dark-theme-black);
            --swal2-color: var(--swal2-dark-theme-white);
            --swal2-footer-border-color: #555;
            --swal2-input-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);
            --swal2-validation-message-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);
            --swal2-validation-message-color: var(--swal2-dark-theme-white);
            --swal2-timer-progress-bar-background: rgba(255, 255, 255, 0.7)
        }

        @media(prefers-color-scheme: dark) {
            [data-swal2-theme=auto] {
                --swal2-dark-theme-black: #19191a;
                --swal2-dark-theme-white: #e1e1e1;
                --swal2-background: var(--swal2-dark-theme-black);
                --swal2-color: var(--swal2-dark-theme-white);
                --swal2-footer-border-color: #555;
                --swal2-input-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);
                --swal2-validation-message-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);
                --swal2-validation-message-color: var(--swal2-dark-theme-white);
                --swal2-timer-progress-bar-background: rgba(255, 255, 255, 0.7)
            }
        }

        body.swal2-shown:not(.swal2-no-backdrop, .swal2-toast-shown) {
            overflow: hidden
        }

        body.swal2-height-auto {
            height: auto !important
        }

        body.swal2-no-backdrop .swal2-container {
            background-color: rgba(0, 0, 0, 0) !important;
            pointer-events: none
        }

        body.swal2-no-backdrop .swal2-container .swal2-popup {
            pointer-events: all
        }

        body.swal2-no-backdrop .swal2-container .swal2-modal {
            box-shadow: 0 0 10px var(--swal2-backdrop)
        }

        body.swal2-toast-shown .swal2-container {
            box-sizing: border-box;
            width: 360px;
            max-width: 100%;
            background-color: rgba(0, 0, 0, 0);
            pointer-events: none
        }

        body.swal2-toast-shown .swal2-container.swal2-top {
            inset: 0 auto auto 50%;
            transform: translateX(-50%)
        }

        body.swal2-toast-shown .swal2-container.swal2-top-end,
        body.swal2-toast-shown .swal2-container.swal2-top-right {
            inset: 0 0 auto auto
        }

        body.swal2-toast-shown .swal2-container.swal2-top-start,
        body.swal2-toast-shown .swal2-container.swal2-top-left {
            inset: 0 auto auto 0
        }

        body.swal2-toast-shown .swal2-container.swal2-center-start,
        body.swal2-toast-shown .swal2-container.swal2-center-left {
            inset: 50% auto auto 0;
            transform: translateY(-50%)
        }

        body.swal2-toast-shown .swal2-container.swal2-center {
            inset: 50% auto auto 50%;
            transform: translate(-50%, -50%)
        }

        body.swal2-toast-shown .swal2-container.swal2-center-end,
        body.swal2-toast-shown .swal2-container.swal2-center-right {
            inset: 50% 0 auto auto;
            transform: translateY(-50%)
        }

        body.swal2-toast-shown .swal2-container.swal2-bottom-start,
        body.swal2-toast-shown .swal2-container.swal2-bottom-left {
            inset: auto auto 0 0
        }

        body.swal2-toast-shown .swal2-container.swal2-bottom {
            inset: auto auto 0 50%;
            transform: translateX(-50%)
        }

        body.swal2-toast-shown .swal2-container.swal2-bottom-end,
        body.swal2-toast-shown .swal2-container.swal2-bottom-right {
            inset: auto 0 0 auto
        }

        @media print {
            body.swal2-shown:not(.swal2-no-backdrop, .swal2-toast-shown) {
                overflow-y: scroll !important
            }

            body.swal2-shown:not(.swal2-no-backdrop, .swal2-toast-shown)>[aria-hidden=true] {
                display: none
            }

            body.swal2-shown:not(.swal2-no-backdrop, .swal2-toast-shown) .swal2-container {
                position: static !important
            }
        }

        div:where(.swal2-container) {
            display: grid;
            position: fixed;
            z-index: 1060;
            inset: 0;
            box-sizing: border-box;
            grid-template-areas: "top-start     top            top-end" "center-start  center         center-end" "bottom-start  bottom-center  bottom-end";
            grid-template-rows: minmax(min-content, auto) minmax(min-content, auto) minmax(min-content, auto);
            height: 100%;
            padding: var(--swal2-container-padding);
            overflow-x: hidden;
            transition: var(--swal2-backdrop-transition);
            -webkit-overflow-scrolling: touch
        }

        div:where(.swal2-container).swal2-backdrop-show,
        div:where(.swal2-container).swal2-noanimation {
            background: var(--swal2-backdrop)
        }

        div:where(.swal2-container).swal2-backdrop-hide {
            background: rgba(0, 0, 0, 0) !important
        }

        div:where(.swal2-container).swal2-top-start,
        div:where(.swal2-container).swal2-center-start,
        div:where(.swal2-container).swal2-bottom-start {
            grid-template-columns: minmax(0, 1fr) auto auto
        }

        div:where(.swal2-container).swal2-top,
        div:where(.swal2-container).swal2-center,
        div:where(.swal2-container).swal2-bottom {
            grid-template-columns: auto minmax(0, 1fr) auto
        }

        div:where(.swal2-container).swal2-top-end,
        div:where(.swal2-container).swal2-center-end,
        div:where(.swal2-container).swal2-bottom-end {
            grid-template-columns: auto auto minmax(0, 1fr)
        }

        div:where(.swal2-container).swal2-top-start>.swal2-popup {
            align-self: start
        }

        div:where(.swal2-container).swal2-top>.swal2-popup {
            grid-column: 2;
            place-self: start center
        }

        div:where(.swal2-container).swal2-top-end>.swal2-popup,
        div:where(.swal2-container).swal2-top-right>.swal2-popup {
            grid-column: 3;
            place-self: start end
        }

        div:where(.swal2-container).swal2-center-start>.swal2-popup,
        div:where(.swal2-container).swal2-center-left>.swal2-popup {
            grid-row: 2;
            align-self: center
        }

        div:where(.swal2-container).swal2-center>.swal2-popup {
            grid-column: 2;
            grid-row: 2;
            place-self: center center
        }

        div:where(.swal2-container).swal2-center-end>.swal2-popup,
        div:where(.swal2-container).swal2-center-right>.swal2-popup {
            grid-column: 3;
            grid-row: 2;
            place-self: center end
        }

        div:where(.swal2-container).swal2-bottom-start>.swal2-popup,
        div:where(.swal2-container).swal2-bottom-left>.swal2-popup {
            grid-column: 1;
            grid-row: 3;
            align-self: end
        }

        div:where(.swal2-container).swal2-bottom>.swal2-popup {
            grid-column: 2;
            grid-row: 3;
            place-self: end center
        }

        div:where(.swal2-container).swal2-bottom-end>.swal2-popup,
        div:where(.swal2-container).swal2-bottom-right>.swal2-popup {
            grid-column: 3;
            grid-row: 3;
            place-self: end end
        }

        div:where(.swal2-container).swal2-grow-row>.swal2-popup,
        div:where(.swal2-container).swal2-grow-fullscreen>.swal2-popup {
            grid-column: 1/4;
            width: 100%
        }

        div:where(.swal2-container).swal2-grow-column>.swal2-popup,
        div:where(.swal2-container).swal2-grow-fullscreen>.swal2-popup {
            grid-row: 1/4;
            align-self: stretch
        }

        div:where(.swal2-container).swal2-no-transition {
            transition: none !important
        }

        div:where(.swal2-container)[popover] {
            width: auto;
            border: 0
        }

        div:where(.swal2-container) div:where(.swal2-popup) {
            display: none;
            position: relative;
            box-sizing: border-box;
            grid-template-columns: minmax(0, 100%);
            width: var(--swal2-width);
            max-width: 100%;
            padding: var(--swal2-padding);
            border: var(--swal2-border);
            border-radius: var(--swal2-border-radius);
            background: var(--swal2-background);
            color: var(--swal2-color);
            font-family: inherit;
            font-size: 1rem;
            container-name: swal2-popup
        }

        div:where(.swal2-container) div:where(.swal2-popup):focus {
            outline: none
        }

        div:where(.swal2-container) div:where(.swal2-popup).swal2-loading {
            overflow-y: hidden
        }

        div:where(.swal2-container) div:where(.swal2-popup).swal2-draggable {
            cursor: grab
        }

        div:where(.swal2-container) div:where(.swal2-popup).swal2-draggable div:where(.swal2-icon) {
            cursor: grab
        }

        div:where(.swal2-container) div:where(.swal2-popup).swal2-dragging {
            cursor: grabbing
        }

        div:where(.swal2-container) div:where(.swal2-popup).swal2-dragging div:where(.swal2-icon) {
            cursor: grabbing
        }

        div:where(.swal2-container) h2:where(.swal2-title) {
            position: relative;
            max-width: 100%;
            margin: 0;
            padding: var(--swal2-title-padding);
            color: inherit;
            font-size: 1.875em;
            font-weight: 600;
            text-align: center;
            text-transform: none;
            overflow-wrap: break-word;
            cursor: initial
        }

        div:where(.swal2-container) div:where(.swal2-actions) {
            display: flex;
            z-index: 1;
            box-sizing: border-box;
            flex-wrap: wrap;
            align-items: center;
            justify-content: var(--swal2-actions-justify-content);
            width: var(--swal2-actions-width);
            margin: var(--swal2-actions-margin);
            padding: var(--swal2-actions-padding);
            border-radius: var(--swal2-actions-border-radius);
            background: var(--swal2-actions-background)
        }

        div:where(.swal2-container) div:where(.swal2-loader) {
            display: none;
            align-items: center;
            justify-content: center;
            width: 2.2em;
            height: 2.2em;
            margin: 0 1.875em;
            animation: swal2-rotate-loading 1.5s linear 0s infinite normal;
            border-width: .25em;
            border-style: solid;
            border-radius: 100%;
            border-color: #2778c4 rgba(0, 0, 0, 0) #2778c4 rgba(0, 0, 0, 0)
        }

        div:where(.swal2-container) button:where(.swal2-styled) {
            margin: .3125em;
            padding: .625em 1.1em;
            transition: var(--swal2-action-button-transition);
            border: none;
            box-shadow: 0 0 0 3px rgba(0, 0, 0, 0);
            font-weight: 500
        }

        div:where(.swal2-container) button:where(.swal2-styled):not([disabled]) {
            cursor: pointer
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm) {
            border-radius: var(--swal2-confirm-button-border-radius);
            background: initial;
            background-color: var(--swal2-confirm-button-background-color);
            box-shadow: var(--swal2-confirm-button-box-shadow);
            color: var(--swal2-confirm-button-color);
            font-size: 1em
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm):hover {
            background-color: color-mix(in srgb, var(--swal2-confirm-button-background-color), var(--swal2-action-button-hover))
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm):active {
            background-color: color-mix(in srgb, var(--swal2-confirm-button-background-color), var(--swal2-action-button-active))
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny) {
            border-radius: var(--swal2-deny-button-border-radius);
            background: initial;
            background-color: var(--swal2-deny-button-background-color);
            box-shadow: var(--swal2-deny-button-box-shadow);
            color: var(--swal2-deny-button-color);
            font-size: 1em
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny):hover {
            background-color: color-mix(in srgb, var(--swal2-deny-button-background-color), var(--swal2-action-button-hover))
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny):active {
            background-color: color-mix(in srgb, var(--swal2-deny-button-background-color), var(--swal2-action-button-active))
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel) {
            border-radius: var(--swal2-cancel-button-border-radius);
            background: initial;
            background-color: var(--swal2-cancel-button-background-color);
            box-shadow: var(--swal2-cancel-button-box-shadow);
            color: var(--swal2-cancel-button-color);
            font-size: 1em
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel):hover {
            background-color: color-mix(in srgb, var(--swal2-cancel-button-background-color), var(--swal2-action-button-hover))
        }

        div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel):active {
            background-color: color-mix(in srgb, var(--swal2-cancel-button-background-color), var(--swal2-action-button-active))
        }

        div:where(.swal2-container) button:where(.swal2-styled):focus-visible {
            outline: none;
            box-shadow: var(--swal2-action-button-focus-box-shadow)
        }

        div:where(.swal2-container) button:where(.swal2-styled)[disabled]:not(.swal2-loading) {
            opacity: .4
        }

        div:where(.swal2-container) button:where(.swal2-styled)::-moz-focus-inner {
            border: 0
        }

        div:where(.swal2-container) div:where(.swal2-footer) {
            margin: 1em 0 0;
            padding: 1em 1em 0;
            border-top: 1px solid var(--swal2-footer-border-color);
            background: var(--swal2-footer-background);
            color: var(--swal2-footer-color);
            font-size: 1em;
            text-align: center;
            cursor: initial
        }

        div:where(.swal2-container) .swal2-timer-progress-bar-container {
            position: absolute;
            right: 0;
            bottom: 0;
            left: 0;
            grid-column: auto !important;
            overflow: hidden;
            border-bottom-right-radius: var(--swal2-border-radius);
            border-bottom-left-radius: var(--swal2-border-radius)
        }

        div:where(.swal2-container) div:where(.swal2-timer-progress-bar) {
            width: 100%;
            height: .25em;
            background: var(--swal2-timer-progress-bar-background)
        }

        div:where(.swal2-container) img:where(.swal2-image) {
            max-width: 100%;
            margin: 2em auto 1em;
            cursor: initial
        }

        div:where(.swal2-container) button:where(.swal2-close) {
            position: var(--swal2-close-button-position);
            inset: var(--swal2-close-button-inset);
            z-index: 2;
            align-items: center;
            justify-content: center;
            width: 1.2em;
            height: 1.2em;
            margin-top: 0;
            margin-right: 0;
            margin-bottom: -1.2em;
            padding: 0;
            overflow: hidden;
            transition: var(--swal2-close-button-transition);
            border: none;
            border-radius: var(--swal2-border-radius);
            outline: var(--swal2-close-button-outline);
            background: rgba(0, 0, 0, 0);
            color: var(--swal2-close-button-color);
            font-family: monospace;
            font-size: var(--swal2-close-button-font-size);
            cursor: pointer;
            justify-self: end
        }

        div:where(.swal2-container) button:where(.swal2-close):hover {
            transform: var(--swal2-close-button-hover-transform);
            background: rgba(0, 0, 0, 0);
            color: #f27474
        }

        div:where(.swal2-container) button:where(.swal2-close):focus-visible {
            outline: none;
            box-shadow: var(--swal2-close-button-focus-box-shadow)
        }

        div:where(.swal2-container) button:where(.swal2-close)::-moz-focus-inner {
            border: 0
        }

        div:where(.swal2-container) div:where(.swal2-html-container) {
            z-index: 1;
            justify-content: center;
            margin: 0;
            padding: var(--swal2-html-container-padding);
            overflow: auto;
            color: inherit;
            font-size: 1.125em;
            font-weight: normal;
            line-height: normal;
            text-align: center;
            overflow-wrap: break-word;
            word-break: break-word;
            cursor: initial
        }

        div:where(.swal2-container) input:where(.swal2-input),
        div:where(.swal2-container) input:where(.swal2-file),
        div:where(.swal2-container) textarea:where(.swal2-textarea),
        div:where(.swal2-container) select:where(.swal2-select),
        div:where(.swal2-container) div:where(.swal2-radio),
        div:where(.swal2-container) label:where(.swal2-checkbox) {
            margin: 1em 2em 3px
        }

        div:where(.swal2-container) input:where(.swal2-input),
        div:where(.swal2-container) input:where(.swal2-file),
        div:where(.swal2-container) textarea:where(.swal2-textarea) {
            box-sizing: border-box;
            width: auto;
            transition: var(--swal2-input-transition);
            border: var(--swal2-input-border);
            border-radius: var(--swal2-input-border-radius);
            background: var(--swal2-input-background);
            box-shadow: var(--swal2-input-box-shadow);
            color: inherit;
            font-size: 1.125em
        }

        div:where(.swal2-container) input:where(.swal2-input).swal2-inputerror,
        div:where(.swal2-container) input:where(.swal2-file).swal2-inputerror,
        div:where(.swal2-container) textarea:where(.swal2-textarea).swal2-inputerror {
            border-color: #f27474 !important;
            box-shadow: 0 0 2px #f27474 !important
        }

        div:where(.swal2-container) input:where(.swal2-input):hover,
        div:where(.swal2-container) input:where(.swal2-file):hover,
        div:where(.swal2-container) textarea:where(.swal2-textarea):hover {
            box-shadow: var(--swal2-input-hover-box-shadow)
        }

        div:where(.swal2-container) input:where(.swal2-input):focus,
        div:where(.swal2-container) input:where(.swal2-file):focus,
        div:where(.swal2-container) textarea:where(.swal2-textarea):focus {
            border: var(--swal2-input-focus-border);
            outline: none;
            box-shadow: var(--swal2-input-focus-box-shadow)
        }

        div:where(.swal2-container) input:where(.swal2-input)::placeholder,
        div:where(.swal2-container) input:where(.swal2-file)::placeholder,
        div:where(.swal2-container) textarea:where(.swal2-textarea)::placeholder {
            color: #ccc
        }

        div:where(.swal2-container) .swal2-range {
            margin: 1em 2em 3px;
            background: var(--swal2-background)
        }

        div:where(.swal2-container) .swal2-range input {
            width: 80%
        }

        div:where(.swal2-container) .swal2-range output {
            width: 20%;
            color: inherit;
            font-weight: 600;
            text-align: center
        }

        div:where(.swal2-container) .swal2-range input,
        div:where(.swal2-container) .swal2-range output {
            height: 2.625em;
            padding: 0;
            font-size: 1.125em;
            line-height: 2.625em
        }

        div:where(.swal2-container) .swal2-input {
            height: 2.625em;
            padding: 0 .75em
        }

        div:where(.swal2-container) .swal2-file {
            width: 75%;
            margin-right: auto;
            margin-left: auto;
            background: var(--swal2-input-background);
            font-size: 1.125em
        }

        div:where(.swal2-container) .swal2-textarea {
            height: 6.75em;
            padding: .75em
        }

        div:where(.swal2-container) .swal2-select {
            min-width: 50%;
            max-width: 100%;
            padding: .375em .625em;
            background: var(--swal2-input-background);
            color: inherit;
            font-size: 1.125em
        }

        div:where(.swal2-container) .swal2-radio,
        div:where(.swal2-container) .swal2-checkbox {
            align-items: center;
            justify-content: center;
            background: var(--swal2-background);
            color: inherit
        }

        div:where(.swal2-container) .swal2-radio label,
        div:where(.swal2-container) .swal2-checkbox label {
            margin: 0 .6em;
            font-size: 1.125em
        }

        div:where(.swal2-container) .swal2-radio input,
        div:where(.swal2-container) .swal2-checkbox input {
            flex-shrink: 0;
            margin: 0 .4em
        }

        div:where(.swal2-container) label:where(.swal2-input-label) {
            display: flex;
            justify-content: center;
            margin: 1em auto 0
        }

        div:where(.swal2-container) div:where(.swal2-validation-message) {
            align-items: center;
            justify-content: center;
            margin: 1em 0 0;
            padding: .625em;
            overflow: hidden;
            background: var(--swal2-validation-message-background);
            color: var(--swal2-validation-message-color);
            font-size: 1em;
            font-weight: 300
        }

        div:where(.swal2-container) div:where(.swal2-validation-message)::before {
            content: "!";
            display: inline-block;
            width: 1.5em;
            min-width: 1.5em;
            height: 1.5em;
            margin: 0 .625em;
            border-radius: 50%;
            background-color: #f27474;
            color: #fff;
            font-weight: 600;
            line-height: 1.5em;
            text-align: center
        }

        div:where(.swal2-container) .swal2-progress-steps {
            flex-wrap: wrap;
            align-items: center;
            max-width: 100%;
            margin: 1.25em auto;
            padding: 0;
            background: rgba(0, 0, 0, 0);
            font-weight: 600
        }

        div:where(.swal2-container) .swal2-progress-steps li {
            display: inline-block;
            position: relative
        }

        div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step {
            z-index: 20;
            flex-shrink: 0;
            width: 2em;
            height: 2em;
            border-radius: 2em;
            background: #2778c4;
            color: #fff;
            line-height: 2em;
            text-align: center
        }

        div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step {
            background: #2778c4
        }

        div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step~.swal2-progress-step {
            background: var(--swal2-progress-step-background);
            color: #fff
        }

        div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step~.swal2-progress-step-line {
            background: var(--swal2-progress-step-background)
        }

        div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step-line {
            z-index: 10;
            flex-shrink: 0;
            width: 2.5em;
            height: .4em;
            margin: 0 -1px;
            background: #2778c4
        }

        div:where(.swal2-icon) {
            position: relative;
            box-sizing: content-box;
            justify-content: center;
            width: 5em;
            height: 5em;
            margin: 2.5em auto .6em;
            zoom: var(--swal2-icon-zoom);
            border: .25em solid rgba(0, 0, 0, 0);
            border-radius: 50%;
            border-color: #000;
            font-family: inherit;
            line-height: 5em;
            cursor: default;
            user-select: none
        }

        div:where(.swal2-icon) .swal2-icon-content {
            display: flex;
            align-items: center;
            font-size: 3.75em
        }

        div:where(.swal2-icon).swal2-error {
            border-color: #f27474;
            color: #f27474
        }

        div:where(.swal2-icon).swal2-error .swal2-x-mark {
            position: relative;
            flex-grow: 1
        }

        div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line] {
            display: block;
            position: absolute;
            top: 2.3125em;
            width: 2.9375em;
            height: .3125em;
            border-radius: .125em;
            background-color: #f27474
        }

        div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line][class$=left] {
            left: 1.0625em;
            transform: rotate(45deg)
        }

        div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line][class$=right] {
            right: 1em;
            transform: rotate(-45deg)
        }

        @container swal2-popup style(--swal2-icon-animations:true) {
            div:where(.swal2-icon).swal2-error.swal2-icon-show {
                animation: swal2-animate-error-icon .5s
            }

            div:where(.swal2-icon).swal2-error.swal2-icon-show .swal2-x-mark {
                animation: swal2-animate-error-x-mark .5s
            }
        }

        div:where(.swal2-icon).swal2-warning {
            border-color: #f8bb86;
            color: #f8bb86
        }

        @container swal2-popup style(--swal2-icon-animations:true) {
            div:where(.swal2-icon).swal2-warning.swal2-icon-show {
                animation: swal2-animate-error-icon .5s
            }

            div:where(.swal2-icon).swal2-warning.swal2-icon-show .swal2-icon-content {
                animation: swal2-animate-i-mark .5s
            }
        }

        div:where(.swal2-icon).swal2-info {
            border-color: #3fc3ee;
            color: #3fc3ee
        }

        @container swal2-popup style(--swal2-icon-animations:true) {
            div:where(.swal2-icon).swal2-info.swal2-icon-show {
                animation: swal2-animate-error-icon .5s
            }

            div:where(.swal2-icon).swal2-info.swal2-icon-show .swal2-icon-content {
                animation: swal2-animate-i-mark .8s
            }
        }

        div:where(.swal2-icon).swal2-question {
            border-color: #87adbd;
            color: #87adbd
        }

        @container swal2-popup style(--swal2-icon-animations:true) {
            div:where(.swal2-icon).swal2-question.swal2-icon-show {
                animation: swal2-animate-error-icon .5s
            }

            div:where(.swal2-icon).swal2-question.swal2-icon-show .swal2-icon-content {
                animation: swal2-animate-question-mark .8s
            }
        }

        div:where(.swal2-icon).swal2-success {
            border-color: #a5dc86;
            color: #a5dc86
        }

        div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line] {
            position: absolute;
            width: 3.75em;
            height: 7.5em;
            border-radius: 50%
        }

        div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line][class$=left] {
            top: -0.4375em;
            left: -2.0635em;
            transform: rotate(-45deg);
            transform-origin: 3.75em 3.75em;
            border-radius: 7.5em 0 0 7.5em
        }

        div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line][class$=right] {
            top: -0.6875em;
            left: 1.875em;
            transform: rotate(-45deg);
            transform-origin: 0 3.75em;
            border-radius: 0 7.5em 7.5em 0
        }

        div:where(.swal2-icon).swal2-success .swal2-success-ring {
            position: absolute;
            z-index: 2;
            top: -0.25em;
            left: -0.25em;
            box-sizing: content-box;
            width: 100%;
            height: 100%;
            border: .25em solid rgba(165, 220, 134, .3);
            border-radius: 50%
        }

        div:where(.swal2-icon).swal2-success .swal2-success-fix {
            position: absolute;
            z-index: 1;
            top: .5em;
            left: 1.625em;
            width: .4375em;
            height: 5.625em;
            transform: rotate(-45deg)
        }

        div:where(.swal2-icon).swal2-success [class^=swal2-success-line] {
            display: block;
            position: absolute;
            z-index: 2;
            height: .3125em;
            border-radius: .125em;
            background-color: #a5dc86
        }

        div:where(.swal2-icon).swal2-success [class^=swal2-success-line][class$=tip] {
            top: 2.875em;
            left: .8125em;
            width: 1.5625em;
            transform: rotate(45deg)
        }

        div:where(.swal2-icon).swal2-success [class^=swal2-success-line][class$=long] {
            top: 2.375em;
            right: .5em;
            width: 2.9375em;
            transform: rotate(-45deg)
        }

        @container swal2-popup style(--swal2-icon-animations:true) {
            div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-line-tip {
                animation: swal2-animate-success-line-tip .75s
            }

            div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-line-long {
                animation: swal2-animate-success-line-long .75s
            }

            div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-circular-line-right {
                animation: swal2-rotate-success-circular-line 4.25s ease-in
            }
        }

        [class^=swal2] {
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0)
        }

        .swal2-show {
            animation: var(--swal2-show-animation)
        }

        .swal2-hide {
            animation: var(--swal2-hide-animation)
        }

        .swal2-noanimation {
            transition: none
        }

        .swal2-scrollbar-measure {
            position: absolute;
            top: -9999px;
            width: 50px;
            height: 50px;
            overflow: scroll
        }

        .swal2-rtl .swal2-close {
            margin-right: initial;
            margin-left: 0
        }

        .swal2-rtl .swal2-timer-progress-bar {
            right: 0;
            left: auto
        }

        .swal2-toast {
            box-sizing: border-box;
            grid-column: 1/4 !important;
            grid-row: 1/4 !important;
            grid-template-columns: min-content auto min-content;
            padding: 1em;
            overflow-y: hidden;
            border: var(--swal2-toast-border);
            background: var(--swal2-background);
            box-shadow: var(--swal2-toast-box-shadow);
            pointer-events: all
        }

        .swal2-toast>* {
            grid-column: 2
        }

        .swal2-toast h2:where(.swal2-title) {
            margin: .5em 1em;
            padding: 0;
            font-size: 1em;
            text-align: initial
        }

        .swal2-toast .swal2-loading {
            justify-content: center
        }

        .swal2-toast input:where(.swal2-input) {
            height: 2em;
            margin: .5em;
            font-size: 1em
        }

        .swal2-toast .swal2-validation-message {
            font-size: 1em
        }

        .swal2-toast div:where(.swal2-footer) {
            margin: .5em 0 0;
            padding: .5em 0 0;
            font-size: .8em
        }

        .swal2-toast button:where(.swal2-close) {
            grid-column: 3/3;
            grid-row: 1/99;
            align-self: center;
            width: .8em;
            height: .8em;
            margin: 0;
            font-size: 2em
        }

        .swal2-toast div:where(.swal2-html-container) {
            margin: .5em 1em;
            padding: 0;
            overflow: initial;
            font-size: 1em;
            text-align: initial
        }

        .swal2-toast div:where(.swal2-html-container):empty {
            padding: 0
        }

        .swal2-toast .swal2-loader {
            grid-column: 1;
            grid-row: 1/99;
            align-self: center;
            width: 2em;
            height: 2em;
            margin: .25em
        }

        .swal2-toast .swal2-icon {
            grid-column: 1;
            grid-row: 1/99;
            align-self: center;
            width: 2em;
            min-width: 2em;
            height: 2em;
            margin: 0 .5em 0 0
        }

        .swal2-toast .swal2-icon .swal2-icon-content {
            display: flex;
            align-items: center;
            font-size: 1.8em;
            font-weight: bold
        }

        .swal2-toast .swal2-icon.swal2-success .swal2-success-ring {
            width: 2em;
            height: 2em
        }

        .swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line] {
            top: .875em;
            width: 1.375em
        }

        .swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line][class$=left] {
            left: .3125em
        }

        .swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line][class$=right] {
            right: .3125em
        }

        .swal2-toast div:where(.swal2-actions) {
            justify-content: flex-start;
            height: auto;
            margin: 0;
            margin-top: .5em;
            padding: 0 .5em
        }

        .swal2-toast button:where(.swal2-styled) {
            margin: .25em .5em;
            padding: .4em .6em;
            font-size: 1em
        }

        .swal2-toast .swal2-success {
            border-color: #a5dc86
        }

        .swal2-toast .swal2-success [class^=swal2-success-circular-line] {
            position: absolute;
            width: 1.6em;
            height: 3em;
            border-radius: 50%
        }

        .swal2-toast .swal2-success [class^=swal2-success-circular-line][class$=left] {
            top: -0.8em;
            left: -0.5em;
            transform: rotate(-45deg);
            transform-origin: 2em 2em;
            border-radius: 4em 0 0 4em
        }

        .swal2-toast .swal2-success [class^=swal2-success-circular-line][class$=right] {
            top: -0.25em;
            left: .9375em;
            transform-origin: 0 1.5em;
            border-radius: 0 4em 4em 0
        }

        .swal2-toast .swal2-success .swal2-success-ring {
            width: 2em;
            height: 2em
        }

        .swal2-toast .swal2-success .swal2-success-fix {
            top: 0;
            left: .4375em;
            width: .4375em;
            height: 2.6875em
        }

        .swal2-toast .swal2-success [class^=swal2-success-line] {
            height: .3125em
        }

        .swal2-toast .swal2-success [class^=swal2-success-line][class$=tip] {
            top: 1.125em;
            left: .1875em;
            width: .75em
        }

        .swal2-toast .swal2-success [class^=swal2-success-line][class$=long] {
            top: .9375em;
            right: .1875em;
            width: 1.375em
        }

        @container swal2-popup style(--swal2-icon-animations:true) {
            .swal2-toast .swal2-success.swal2-icon-show .swal2-success-line-tip {
                animation: swal2-toast-animate-success-line-tip .75s
            }

            .swal2-toast .swal2-success.swal2-icon-show .swal2-success-line-long {
                animation: swal2-toast-animate-success-line-long .75s
            }
        }

        .swal2-toast.swal2-show {
            animation: var(--swal2-toast-show-animation)
        }

        .swal2-toast.swal2-hide {
            animation: var(--swal2-toast-hide-animation)
        }

        @keyframes swal2-show {
            0% {
                transform: scale(0.7)
            }

            45% {
                transform: scale(1.05)
            }

            80% {
                transform: scale(0.95)
            }

            100% {
                transform: scale(1)
            }
        }

        @keyframes swal2-hide {
            0% {
                transform: scale(1);
                opacity: 1
            }

            100% {
                transform: scale(0.5);
                opacity: 0
            }
        }

        @keyframes swal2-animate-success-line-tip {
            0% {
                top: 1.1875em;
                left: .0625em;
                width: 0
            }

            54% {
                top: 1.0625em;
                left: .125em;
                width: 0
            }

            70% {
                top: 2.1875em;
                left: -0.375em;
                width: 3.125em
            }

            84% {
                top: 3em;
                left: 1.3125em;
                width: 1.0625em
            }

            100% {
                top: 2.8125em;
                left: .8125em;
                width: 1.5625em
            }
        }

        @keyframes swal2-animate-success-line-long {
            0% {
                top: 3.375em;
                right: 2.875em;
                width: 0
            }

            65% {
                top: 3.375em;
                right: 2.875em;
                width: 0
            }

            84% {
                top: 2.1875em;
                right: 0;
                width: 3.4375em
            }

            100% {
                top: 2.375em;
                right: .5em;
                width: 2.9375em
            }
        }

        @keyframes swal2-rotate-success-circular-line {
            0% {
                transform: rotate(-45deg)
            }

            5% {
                transform: rotate(-45deg)
            }

            12% {
                transform: rotate(-405deg)
            }

            100% {
                transform: rotate(-405deg)
            }
        }

        @keyframes swal2-animate-error-x-mark {
            0% {
                margin-top: 1.625em;
                transform: scale(0.4);
                opacity: 0
            }

            50% {
                margin-top: 1.625em;
                transform: scale(0.4);
                opacity: 0
            }

            80% {
                margin-top: -0.375em;
                transform: scale(1.15)
            }

            100% {
                margin-top: 0;
                transform: scale(1);
                opacity: 1
            }
        }

        @keyframes swal2-animate-error-icon {
            0% {
                transform: rotateX(100deg);
                opacity: 0
            }

            100% {
                transform: rotateX(0deg);
                opacity: 1
            }
        }

        @keyframes swal2-rotate-loading {
            0% {
                transform: rotate(0deg)
            }

            100% {
                transform: rotate(360deg)
            }
        }

        @keyframes swal2-animate-question-mark {
            0% {
                transform: rotateY(-360deg)
            }

            100% {
                transform: rotateY(0)
            }
        }

        @keyframes swal2-animate-i-mark {
            0% {
                transform: rotateZ(45deg);
                opacity: 0
            }

            25% {
                transform: rotateZ(-25deg);
                opacity: .4
            }

            50% {
                transform: rotateZ(15deg);
                opacity: .8
            }

            75% {
                transform: rotateZ(-5deg);
                opacity: 1
            }

            100% {
                transform: rotateX(0);
                opacity: 1
            }
        }

        @keyframes swal2-toast-show {
            0% {
                transform: translateY(-0.625em) rotateZ(2deg)
            }

            33% {
                transform: translateY(0) rotateZ(-2deg)
            }

            66% {
                transform: translateY(0.3125em) rotateZ(2deg)
            }

            100% {
                transform: translateY(0) rotateZ(0deg)
            }
        }

        @keyframes swal2-toast-hide {
            100% {
                transform: rotateZ(1deg);
                opacity: 0
            }
        }

        @keyframes swal2-toast-animate-success-line-tip {
            0% {
                top: .5625em;
                left: .0625em;
                width: 0
            }

            54% {
                top: .125em;
                left: .125em;
                width: 0
            }

            70% {
                top: .625em;
                left: -0.25em;
                width: 1.625em
            }

            84% {
                top: 1.0625em;
                left: .75em;
                width: .5em
            }

            100% {
                top: 1.125em;
                left: .1875em;
                width: .75em
            }
        }

        @keyframes swal2-toast-animate-success-line-long {
            0% {
                top: 1.625em;
                right: 1.375em;
                width: 0
            }

            65% {
                top: 1.25em;
                right: .9375em;
                width: 0
            }

            84% {
                top: .9375em;
                right: 0;
                width: 1.125em
            }

            100% {
                top: .9375em;
                right: .1875em;
                width: 1.375em
            }
        }
    </style>
    <meta name="description"
        content="ขายรหัสเกม VALORANT, ROV, FiveM, Discord, Steam, Rockstar ราคาถูก ปลอดภัย ส่งไว มีบริการปลดแบนเกมและ FiveM ติดต่อผ่าน Ticket ได้ทันที">
    <meta name="keywords"
        content="รหัส VALORANT, VALORANT account, ขายไอดีเกม, Discord account, Rockstar account, Steam account, ปลดแบนเกม, ปลดแบน FiveM, FiveM account, รหัส ROV, ROV account, ขายไอดี, รหัส VALORANT, ขายไอดี ROV, FiveM account, Discord account, Rockstar account, Steam account, ขายไอดีเกม, ปลดแบน FiveM, ปลดแบนเกม, game account marketplace">
    <meta name="author" content="ประกาศ
">
    <link rel="icon" type="image/x-icon" href="https://img2.pic.in.th/pic/logodiscordf124e71a99293428.png">
    <meta property="og:site_name" content="kiddyxstore">
    <meta name="description"
        content="ขายรหัสเกม VALORANT, ROV, FiveM, Discord, Steam, Rockstar ราคาถูก ปลอดภัย ส่งไว มีบริการปลดแบนเกมและ FiveM ติดต่อผ่าน Ticket ได้ทันที"
        data-react-helmet="true">
    <meta name="keywords"
        content="รหัส VALORANT, VALORANT account, ขายไอดีเกม, Discord account, Rockstar account, Steam account, ปลดแบนเกม, ปลดแบน FiveM, FiveM account, รหัส ROV, ROV account, ขายไอดี, รหัส VALORANT, ขายไอดี ROV, FiveM account, Discord account, Rockstar account, Steam account, ขายไอดีเกม, ปลดแบน FiveM, ปลดแบนเกม, game account marketplace"
        data-react-helmet="true">
    <meta name="author" content="ประกาศ
" data-react-helmet="true">
    <meta property="og:title" content="Kiddy Store - Welcome" data-react-helmet="true">
    <meta property="og:description"
        content="ขายรหัสเกม VALORANT, ROV, FiveM, Discord, Steam, Rockstar ราคาถูก ปลอดภัย ส่งไว มีบริการปลดแบนเกมและ FiveM ติดต่อผ่าน Ticket ได้ทันที"
        data-react-helmet="true">
    <meta property="og:url" content="http://dion.weloveyouvvv.online" data-react-helmet="true">
    <meta property="og:site_name" content="kiddyxstore" data-react-helmet="true">
    <meta property="og:type" content="website" data-react-helmet="true">
    <meta name="twitter:card" content="summary_large_image" data-react-helmet="true">
    <meta name="twitter:title" content="Kiddy Store - Welcome" data-react-helmet="true">
    <meta name="twitter:description"
        content="ขายรหัสเกม VALORANT, ROV, FiveM, Discord, Steam, Rockstar ราคาถูก ปลอดภัย ส่งไว มีบริการปลดแบนเกมและ FiveM ติดต่อผ่าน Ticket ได้ทันที"
        data-react-helmet="true">
    <meta name="twitter:image" content="https://img5.pic.in.th/file/secure-sv1/banner9924a3e679808591.png"
        data-react-helmet="true">
</head>

<body>
    <div id="root">
        <div class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900"
            style="font-family: Prompt, sans-serif;">
            <header
                class="bg-white/5 backdrop-blur-md shadow-lg absolute top-0 left-0 right-0 z-50 border-b border-white/10">
                <div class="container mx-auto px-6 py-2 max-w-6xl">
                    <div class="flex items-center justify-between"><a class="flex items-center space-x-3" href="/"
                            data-discover="true">
                            <div class="relative "><img alt="kiddyxstore Logo" class="w-10 h-10 object-contain"
                                    src="https://img2.pic.in.th/pic/logodiscordf124e71a99293428.png">
                                <div class="absolute inset-0 bg-blue-500/20 rounded-full blur animate-pulse"></div>
                            </div>
                        </a>
                        <div class="hidden md:flex max-w-xs mr-4 search-container relative">
                            <form class="w-full">
                                <div class="relative"><input placeholder="ค้นหาสินค้า..."
                                        class="w-full bg-white/10 border border-white/20 rounded-full px-3 py-1.5 pr-8 text-white placeholder-white/50 focus:outline-none focus:border-blue-500 focus:bg-white/20 transition-all duration-300 text-xs"
                                        type="text" value=""><button type="submit"
                                        class="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition-colors"><svg
                                            class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                        </svg></button></div>
                            </form>
                        </div>
                        <nav class="hidden md:flex space-x-4"><a
                                class="text-white/80 text-blue-400 transition-colors font-medium text-xs" href="/"
                                data-discover="true">หน้าหลัก</a><a
                                class="text-white/80 text-blue-400 transition-colors font-medium text-xs"
                                href="/category" data-discover="true">ร้านค้า</a><a
                                class="text-white/80 text-blue-400 transition-colors font-medium text-xs" href="/topup"
                                data-discover="true">เติมเงิน</a><a
                                class="text-white/80 text-blue-400 transition-colors font-medium text-xs" href="/crypto"
                                data-discover="true">แลกคริปโต</a><a
                                class="text-white/80 text-blue-400 transition-colors font-medium flex items-center space-x-1 text-xs"
                                href="/contact" data-discover="true"><span>ติดต่อเรา</span><svg class="w-2.5 h-2.5"
                                    fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd"
                                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                        clip-rule="evenodd"></path>
                                </svg></a></nav><button
                            class="md:hidden flex items-center justify-center w-8 h-8 text-white/80 hover:text-white transition-colors"><svg
                                class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg></button>
                        <div class="hidden md:flex items-center space-x-3">
                            <div class="flex items-center space-x-2">
                                <div class="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div><span
                                    class="text-white/70 text-xs font-medium">24/7</span>
                            </div>
                            <div class="relative group"><button
                                    class="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border border-white/20 hover:border-white/40">
                                    <div
                                        class="w-6 h-6 from-white-500 to-white-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        A</div><svg class="w-3 h-3" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </button>
                                <div
                                    class="absolute right-0 mt-2 w-48 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                                    <div class="py-3">
                                        <div class="px-3 py-2 border-b border-white/10">
                                            <div class="text-white text-xs font-medium">adadadasd</div>
                                            <div class="text-white/60 text-xs">2,112.24 บาท</div>
                                        </div>
                                        <div class="py-1"><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/profile" data-discover="true"><svg class="w-3 h-3 mr-2"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                                                    </path>
                                                </svg>โปรไฟล์</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/topup" data-discover="true"><svg class="w-3 h-3 mr-2" fill="none"
                                                    stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1">
                                                    </path>
                                                </svg>เติมเงิน</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/crypto" data-discover="true"><svg class="w-3 h-3 mr-2"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1">
                                                    </path>
                                                </svg>แลกคริปโต</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/search" data-discover="true"><svg class="w-3 h-3 mr-2"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                                </svg>ค้นหาเกม</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/transactions" data-discover="true"><svg class="w-3 h-3 mr-2"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01">
                                                    </path>
                                                </svg>ประวัติการซื้อ</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/topup/history" data-discover="true"><svg class="w-3 h-3 mr-2"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M9 12l2 2 4-4">
                                                    </path>
                                                </svg>ประวัติการเติมเงิน</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                                href="/hwid" data-discover="true"><svg class="w-3 h-3 mr-2" fill="none"
                                                    stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
                                                    </path>
                                                </svg>Reset HWID</a><a
                                                class="flex items-center px-3 py-1.5 text-xs text-blue-400 bg-blue-500/10 transition-colors"
                                                href="/admin" data-discover="true"><svg class="w-3 h-3 mr-2" fill="none"
                                                    stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z">
                                                    </path>
                                                </svg>Admin</a>
                                            <div class="border-t border-white/10 my-1"></div><button
                                                class="flex items-center w-full px-3 py-1.5 text-xs text-blue-400 bg-blue-500/10 transition-colors"><svg
                                                    class="w-3 h-3 mr-2" fill="none" stroke="currentColor"
                                                    viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                                                    </path>
                                                </svg>ออกจากระบบ</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <div class="min-h-screen py-8 px-4">
                <div class="max-w-7xl mt-16 mx-auto">
                    <div class="text-center mb-12 mt-16"><button
                            class="text-blue-400 group-hover:text-gray-300 mb-4 flex items-center justify-center mx-auto">←
                            กลับไปเลือกหมวดหมู่</button>
                        <h1 class="text-3xl md:text-4xl font-bold text-white mb-4">Unban Hub</h1>
                    </div>
                    <div class="mb-12">
                        <h2 class="text-2xl font-bold text-white mb-6 text-center">สินค้าในหมวดหมู่นี้</h2>
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                            <style>
                                @keyframes bounceInUp {
                                    0% {
                                        opacity: 0;
                                        transform: translateY(30px) scale(0.9);
                                    }

                                    50% {
                                        opacity: 0.8;
                                        transform: translateY(-10px) scale(1.05);
                                    }

                                    100% {
                                        opacity: 1;
                                        transform: translateY(0) scale(1);
                                    }
                                }

                                .bounce-in {
                                    animation: bounceInUp 0.8s ease-out forwards;
                                }
                            </style>
                            <div class="transform transition-all duration-700 bounce-in" style="animation-delay: 0ms;">
                                <div
                                    class="group transform transition-all duration-500 w-full min-h-80 cursor-pointer hover:scale-105 hover:-translate-y-2">
                                    <div
                                        class="bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-500 shadow-2xl hover:shadow-blue-500/20 group-hover:bg-white/10 h-full flex flex-col ">
                                        <div class="relative h-48 overflow-hidden flex-shrink-0"><img
                                                alt="ปลดแบนฮอน ( ถาวร )"
                                                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                src="https://img2.pic.in.th/pic/Untitled-2e1163155a929c6b9.webp">
                                            <div class="absolute top-2 left-2">
                                                <div class="backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2 shadow-lg border"
                                                    style="background-color: rgba(17, 255, 0, 0.125); border-color: rgba(17, 255, 0, 0.314);">
                                                    <div class="w-5 h-5 rounded-sm flex items-center justify-center"
                                                        style="background-color: rgb(17, 255, 0);"><svg
                                                            class="w-3 h-3 text-white" fill="currentColor"
                                                            viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd"
                                                                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                clip-rule="evenodd"></path>
                                                        </svg></div><span class="font-bold"
                                                        style="color: rgb(17, 255, 0); font-size: 0.875rem;">มีประกันถาวร</span>
                                                </div>
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                                            </div>
                                            <div
                                                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div class="bg-white/20 backdrop-blur-sm rounded-full p-3"><svg
                                                        class="w-6 h-6 text-white" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                                    </svg></div>
                                            </div>
                                        </div>
                                        <div class="p-4 flex flex-col flex-grow"><span
                                                class="text-xs mb-2 text-gray-400">คงเหลือ: 85 ชิ้น</span>
                                            <h3 class="text-sm font-bold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300 truncate"
                                                title="ปลดแบนฮอน ( ถาวร )">ปลดแบนฮอน ( ถาวร )</h3>
                                            <div class="flex justify-between items-center mb-3 flex-shrink-0">
                                                <div class="flex items-center space-x-2"><span
                                                        class="text-lg font-bold text-blue-400">฿150.00</span></div>
                                            </div><button
                                                class="w-full font-bold py-2 px-3 rounded-lg transition-all duration-300 text-sm flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg hover:shadow-blue-500/25">ซื้อสินค้า</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <style>
                                @keyframes bounceInUp {
                                    0% {
                                        opacity: 0;
                                        transform: translateY(30px) scale(0.9);
                                    }

                                    50% {
                                        opacity: 0.8;
                                        transform: translateY(-10px) scale(1.05);
                                    }

                                    100% {
                                        opacity: 1;
                                        transform: translateY(0) scale(1);
                                    }
                                }

                                .bounce-in {
                                    animation: bounceInUp 0.8s ease-out forwards;
                                }
                            </style>
                            <div class="transform transition-all duration-700 bounce-in" style="animation-delay: 50ms;">
                                <div
                                    class="group transform transition-all duration-500 w-full min-h-80 cursor-pointer hover:scale-105 hover:-translate-y-2">
                                    <div
                                        class="bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-500 shadow-2xl hover:shadow-blue-500/20 group-hover:bg-white/10 h-full flex flex-col ">
                                        <div class="relative h-48 overflow-hidden flex-shrink-0"><img
                                                alt="ปลดแบนทุกเซิฟและปลดแบน FiveM ( ถาวร )"
                                                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                src="https://img2.pic.in.th/pic/Kiddyxstore-Poster-02-1.webp">
                                            <div class="absolute top-2 left-2">
                                                <div class="backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2 shadow-lg border"
                                                    style="background-color: rgba(17, 255, 0, 0.125); border-color: rgba(17, 255, 0, 0.314);">
                                                    <div class="w-5 h-5 rounded-sm flex items-center justify-center"
                                                        style="background-color: rgb(17, 255, 0);"><svg
                                                            class="w-3 h-3 text-white" fill="currentColor"
                                                            viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd"
                                                                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                clip-rule="evenodd"></path>
                                                        </svg></div><span class="font-bold"
                                                        style="color: rgb(17, 255, 0); font-size: 0.875rem;">ปลดออกถาวร</span>
                                                </div>
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                                            </div>
                                            <div
                                                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div class="bg-white/20 backdrop-blur-sm rounded-full p-3"><svg
                                                        class="w-6 h-6 text-white" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                                    </svg></div>
                                            </div>
                                        </div>
                                        <div class="p-4 flex flex-col flex-grow"><span
                                                class="text-xs mb-2 text-blue-400 font-semibold">คงเหลือ:
                                                ไม่จำกัด</span>
                                            <h3 class="text-sm font-bold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300 truncate"
                                                title="ปลดแบนทุกเซิฟและปลดแบน FiveM ( ถาวร )">ปลดแบนทุกเซิฟและปลดแบน
                                                FiveM ( ถาวร )</h3>
                                            <div class="flex justify-between items-center mb-3 flex-shrink-0">
                                                <div class="flex items-center space-x-2"><span
                                                        class="text-lg font-bold text-blue-400">฿239.00</span></div>
                                            </div><button
                                                class="w-full font-bold py-2 px-3 rounded-lg transition-all duration-300 text-sm flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg hover:shadow-blue-500/25">ซื้อสินค้า</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <style>
                                @keyframes bounceInUp {
                                    0% {
                                        opacity: 0;
                                        transform: translateY(30px) scale(0.9);
                                    }

                                    50% {
                                        opacity: 0.8;
                                        transform: translateY(-10px) scale(1.05);
                                    }

                                    100% {
                                        opacity: 1;
                                        transform: translateY(0) scale(1);
                                    }
                                }

                                .bounce-in {
                                    animation: bounceInUp 0.8s ease-out forwards;
                                }
                            </style>
                            <div class="transform transition-all duration-700 bounce-in"
                                style="animation-delay: 100ms;">
                                <div
                                    class="group transform transition-all duration-500 w-full min-h-80 cursor-pointer hover:scale-105 hover:-translate-y-2">
                                    <div
                                        class="bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-500 shadow-2xl hover:shadow-blue-500/20 group-hover:bg-white/10 h-full flex flex-col ">
                                        <div class="relative h-48 overflow-hidden flex-shrink-0"><img
                                                alt="ปลดแบน BT ( ถาวร )"
                                                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                src="https://img5.pic.in.th/file/secure-sv1/Kiddyxstore-Unban-FivemServer-1.webp">
                                            <div class="absolute top-2 left-2">
                                                <div class="backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2 shadow-lg border"
                                                    style="background-color: rgba(17, 255, 0, 0.125); border-color: rgba(17, 255, 0, 0.314);">
                                                    <div class="w-5 h-5 rounded-sm flex items-center justify-center"
                                                        style="background-color: rgb(17, 255, 0);"><svg
                                                            class="w-3 h-3 text-white" fill="currentColor"
                                                            viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd"
                                                                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                clip-rule="evenodd"></path>
                                                        </svg></div><span class="font-bold"
                                                        style="color: rgb(17, 255, 0); font-size: 0.875rem;">ปลดออก
                                                        100%</span>
                                                </div>
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                                            </div>
                                            <div
                                                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div class="bg-white/20 backdrop-blur-sm rounded-full p-3"><svg
                                                        class="w-6 h-6 text-white" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                                    </svg></div>
                                            </div>
                                        </div>
                                        <div class="p-4 flex flex-col flex-grow"><span
                                                class="text-xs mb-2 text-gray-400">คงเหลือ: 84 ชิ้น</span>
                                            <h3 class="text-sm font-bold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300 truncate"
                                                title="ปลดแบน BT ( ถาวร )">ปลดแบน BT ( ถาวร )</h3>
                                            <div class="flex justify-between items-center mb-3 flex-shrink-0">
                                                <div class="flex items-center space-x-2"><span
                                                        class="text-lg font-bold text-blue-400">฿139.00</span></div>
                                            </div><button
                                                class="w-full font-bold py-2 px-3 rounded-lg transition-all duration-300 text-sm flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg hover:shadow-blue-500/25">ซื้อสินค้า</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <style>
                                @keyframes bounceInUp {
                                    0% {
                                        opacity: 0;
                                        transform: translateY(30px) scale(0.9);
                                    }

                                    50% {
                                        opacity: 0.8;
                                        transform: translateY(-10px) scale(1.05);
                                    }

                                    100% {
                                        opacity: 1;
                                        transform: translateY(0) scale(1);
                                    }
                                }

                                .bounce-in {
                                    animation: bounceInUp 0.8s ease-out forwards;
                                }
                            </style>
                            <div class="transform transition-all duration-700 bounce-in"
                                style="animation-delay: 150ms;">
                                <div
                                    class="group transform transition-all duration-500 w-full min-h-80 cursor-pointer hover:scale-105 hover:-translate-y-2">
                                    <div
                                        class="bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all duration-500 shadow-2xl hover:shadow-blue-500/20 group-hover:bg-white/10 h-full flex flex-col ">
                                        <div class="relative h-48 overflow-hidden flex-shrink-0"><img
                                                alt="ปลดแบนทุกเกม ( ถาวร )"
                                                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                src="https://img2.pic.in.th/pic/Kiddyxstore-Unban-Valorant.webp">
                                            <div class="absolute top-2 left-2">
                                                <div class="backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2 shadow-lg border"
                                                    style="background-color: rgba(17, 255, 0, 0.125); border-color: rgba(17, 255, 0, 0.314);">
                                                    <div class="w-5 h-5 rounded-sm flex items-center justify-center"
                                                        style="background-color: rgb(17, 255, 0);"><svg
                                                            class="w-3 h-3 text-white" fill="currentColor"
                                                            viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd"
                                                                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                clip-rule="evenodd"></path>
                                                        </svg></div><span class="font-bold"
                                                        style="color: rgb(17, 255, 0); font-size: 0.875rem;">ปลดไม่ออกคืนเงิน</span>
                                                </div>
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                                            </div>
                                            <div
                                                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
                                            </div>
                                            <div
                                                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div class="bg-white/20 backdrop-blur-sm rounded-full p-3"><svg
                                                        class="w-6 h-6 text-white" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                                    </svg></div>
                                            </div>
                                        </div>
                                        <div class="p-4 flex flex-col flex-grow"><span
                                                class="text-xs mb-2 text-blue-400 font-semibold">คงเหลือ:
                                                ไม่จำกัด</span>
                                            <h3 class="text-sm font-bold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300 truncate"
                                                title="ปลดแบนทุกเกม ( ถาวร )">ปลดแบนทุกเกม ( ถาวร )</h3>
                                            <div class="flex justify-between items-center mb-3 flex-shrink-0">
                                                <div class="flex items-center space-x-2"><span
                                                        class="text-lg font-bold text-blue-400">฿199.00</span></div>
                                            </div><button
                                                class="w-full font-bold py-2 px-3 rounded-lg transition-all duration-300 text-sm flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg hover:shadow-blue-500/25">ซื้อสินค้า</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <section class="Toastify" aria-live="polite" aria-atomic="false" aria-relevant="additions text"
                aria-label="Notifications Alt+T"></section>
        </div>
    </div>
    <script defer=""
        src="https://static.cloudflareinsights.com/beacon.min.js/vcd15cbe7772f49c399c6a5babf22c1241717689176015"
        integrity="sha512-ZpsOmlRQV6y907TI0dKBHq9Md29nnaEIPlkf84rnaERnq6zvWvPUqr2ft8M1aS28oN72PdrCzSjY4U6VaAw1EQ=="
        data-cf-beacon="{&quot;version&quot;:&quot;2024.11.0&quot;,&quot;token&quot;:&quot;e74762656f924c22aac62acbcb692fff&quot;,&quot;r&quot;:1,&quot;server_timing&quot;:{&quot;name&quot;:{&quot;cfCacheStatus&quot;:true,&quot;cfEdge&quot;:true,&quot;cfExtPri&quot;:true,&quot;cfL4&quot;:true,&quot;cfOrigin&quot;:true,&quot;cfSpeedBrain&quot;:true},&quot;location_startswith&quot;:null}}"
        crossorigin="anonymous"></script>


    <div id="give-freely-root-ejkiikneibegknkgimmihdpcbcedgmpo" class="give-freely-root"
        data-extension-id="ejkiikneibegknkgimmihdpcbcedgmpo" data-extension-name="Volume Booster"
        style="display: block;"></div>
</body>

</html>