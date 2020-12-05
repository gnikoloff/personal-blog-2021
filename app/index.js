import 'normalize.css'
import './style.scss'

document.addEventListener('DOMContentLoaded', init)

function init () {
  if (document.body.classList.contains('homepage')) {
    initHome()
  } else if (document.body.classList.contains('single-blog')) {
    initSingle()
  }
}

function initSingle () {
  const allSnippets = document.querySelectorAll('.single-blog-main pre')
  // debugger
  for (let i = 0; i < allSnippets.length; i++) {
    const snippet = allSnippets[i]
    let newSnippetHTML = ''
    for (let i = 0; i < snippet.children.length; i++) {
      const node = snippet.children[i]
      const nodeName = node.nodeName
      if (nodeName === 'P') {
        if (!node.innerHTML.trim().length) {
          node.parentNode.removeChild(node)
        }
        const nodeText = node.textContent
        newSnippetHTML += nodeText
        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      }
    }
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
