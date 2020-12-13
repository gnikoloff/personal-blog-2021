import 'normalize.css'
import './style.scss'

import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import glsl from 'highlight.js/lib/languages/glsl'
import mediumZoom from 'medium-zoom'

import 'highlight.js/styles/codepen-embed.css';

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('glsl', glsl)

document.addEventListener('DOMContentLoaded', init)

function init () {
  if (document.body.classList.contains('homepage')) {
    initHome()
  } else if (document.body.classList.contains('single-blog')) {
    initSingleBlog()
  } else if (document.body.classList.contains('single-work')) {
    initSingleWork()
  }
}

function initSingleWork () {
  const allImages = document.querySelectorAll('.single-work img')
  mediumZoom(allImages, {
    container: {
      width: innerWidth,
      height: innerHeight,
      top: 32,
      bottom: 32,
      right: 0,
      left: 0,
    }
  })
}

function initSingleBlog () {

  const allSnippets = document.querySelectorAll('.single-blog-main pre')
  for (let i = 0; i < allSnippets.length; i++) {
    const snippet = allSnippets[i]
    if (snippet.classList.contains('inline-pre')) {
      continue
    }

    // hljs.highlightBlock(snippet)
    snippet.style.opacity = '0'
    let newSnippetHTML = ''
    console.log(snippet.children)
    for (let i = 0; i < snippet.children.length; i++) {
      const node = snippet.children[i]
      const nodeName = node.nodeName
      console.log(node.innerHTML)
      // if (nodeName === 'P') {
        if (!node.innerHTML.trim().length) {
          // node.parentNode.removeChild(node)
        }
        const nodeText = node.innerHTML.trim()
        // console.log(node.innerHTML)
        if (nodeText.startsWith('// ')) {
          newSnippetHTML += `${nodeText}\n`
        } else {
          newSnippetHTML += `${nodeText}\n`
        }
        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      // }
    }
    const codeTag = document.createElement('code')
    codeTag.innerHTML = `
      <pre>
        ${newSnippetHTML}
      </pre>
    `
    // console.log(codeTag)
    snippet.replaceWith(codeTag)
    setTimeout(() => {
      // hljs.highlightBlock(codeTag);
      snippet.style.opacity = '1'
    }, 0)
  }
}

function initHome () {
  const allWorks = document.getElementsByClassName('preview')
  for (let i = 0; i < allWorks.length; i++) {
    const workEl = allWorks[i]
    const imageSrc = workEl.getAttribute('data-image')
    const imageAlt = workEl.getAttribute('data-alt')
    const imageWrapper = workEl.getElementsByClassName('preview-image-wrapper')[0]
    const makeImage = () => {
      const img = document.createElement('img')
      img.setAttribute('src', imageSrc)
      img.setAttribute('alt', imageAlt)
      imageWrapper.appendChild(img)
    }
    if (imageSrc) {
      if (supportIntersectObserver()) {
        const onObserve = entries => {
          const entry = entries[0]
          if (entry.isIntersecting) {
            makeImage()
            observer.unobserve(workEl)
          }
        }
        const observer = new IntersectionObserver(onObserve)
        observer.observe(workEl)
      } else {
        makeImage()
      }
    }
  }
}

function supportIntersectObserver () {
  return 'IntersectionObserver' in window && 'IntersectionObserverEntry' in window && 'intersectionRatio' in window.IntersectionObserverEntry.prototype
}
