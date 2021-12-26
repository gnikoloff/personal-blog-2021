import 'normalize.css'
import './style.scss'

import hljs from 'highlight.js/lib/core'

import xml from 'highlight.js/lib/languages/xml'
import javascript from 'highlight.js/lib/languages/javascript'
import glsl from 'highlight.js/lib/languages/glsl'

import mediumZoom from 'medium-zoom'

import 'highlight.js/styles/codepen-embed.css'

hljs.registerLanguage('xml', xml)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('glsl', glsl)

const BACKEND_URL = 'http://localhost:3000'

document.addEventListener('DOMContentLoaded', init)

function init() {
  if (document.body.classList.contains('homepage')) {
    initHome()
  }
  if (document.body.classList.contains('single-blog')) {
    initSingleBlog()
  }
  if (document.body.classList.contains('single-work')) {
    initSingleWork()
  }
  if (document.body.classList.contains('contact')) {
    initContact()
  }
}

function initSingleWork() {
  const allImages = document.querySelectorAll('.single-work img')
  mediumZoom(allImages, {
    container: {
      width: innerWidth,
      height: innerHeight,
      top: 32,
      bottom: 32,
      right: 0,
      left: 0,
    },
  })

  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightBlock(block)
  })
}

function initSingleBlog() {
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightBlock(block)
  })
}

function initHome() {
  const allWorks = document.getElementsByClassName('preview')
  for (let i = 0; i < allWorks.length; i++) {
    const workEl = allWorks[i]
    const imageSrc = workEl.getAttribute('data-image')
    const imageAlt = workEl.getAttribute('data-alt')
    const imageWrapper = workEl.getElementsByClassName(
      'preview-image-wrapper',
    )[0]
    const makeImage = () => {
      const img = document.createElement('img')
      img.classList.add('project-preview-image')
      img.setAttribute('src', imageSrc)
      img.setAttribute('alt', imageAlt)
      requestAnimationFrame(() => {
        img.classList.add('inView')
      })
      imageWrapper.appendChild(img)
    }
    if (imageSrc) {
      if (supportIntersectObserver()) {
        const onObserve = (entries) => {
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

function initContact() {
  const form = document.getElementById('contact-form')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const formData = new FormData(form)
    const formParams = new URLSearchParams(formData).toString()
    fetch(`${BACKEND_URL}/contact?${formParams}`, {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.type === 'ERROR') {
          console.error(JSON.parse(res.payload))
        }
      })
  })
  const budgetInputWrapper = document.getElementById('budget-group')
  const budgetInput = document.getElementById('budget')
  const projectTypeSelect = document.getElementById('project-type')

  projectTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Project') {
      budgetInput.setAttribute('required', '')
      budgetInputWrapper.style.setProperty('display', 'block')
    } else {
      budgetInput.removeAttribute('required')
      budgetInputWrapper.style.removeProperty('display')
    }
  })
}

function supportIntersectObserver() {
  return (
    'IntersectionObserver' in window &&
    'IntersectionObserverEntry' in window &&
    'intersectionRatio' in window.IntersectionObserverEntry.prototype
  )
}
