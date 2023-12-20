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

const BACKEND_URL = location.origin

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
  if (document.body.classList.contains('cv')) {
    initCV()
  }
}

function initCV() {
  const printButtons = document.getElementsByClassName('print')
  for (let i = 0; i < printButtons.length; i++) {
    const printBtn = printButtons[i]
    printBtn.addEventListener('click', () => {
      print()
    })
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
  const emailLoadbar = document.querySelector('.email-send-loader-wrapper')

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const formData = new FormData(form)
    const formParams = new URLSearchParams(formData).toString()
    emailLoadbar.classList.add('visible')
    const url = `${BACKEND_URL}/contact?${formParams}`
    fetch(url, {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((res) => {
        emailLoadbar.classList.remove('visible')
        const inputs = form.getElementsByTagName('input')
        for (let i = 0; i < inputs.length; i++) {
          if (inputs[i].getAttribute('type') !== 'submit') {
            inputs[i].value = ''
          }
        }
        const textarea = form.getElementsByTagName('textarea')
        for (let i = 0; i < textarea.length; i++) {
          textarea[i].value = ''
        }

        if (res.type === 'ERROR') {
          console.error(JSON.parse(res.payload))
        } else {
          const formSuccess = document.getElementsByClassName(
            'contact-form-success',
          )[0]
          const formWrapper = document.getElementsByClassName(
            'contact-form-wrapper',
          )[0]
          formSuccess.style.setProperty('display', 'block')
          formWrapper.style.setProperty('display', 'none')
          setTimeout(() => {
            formSuccess.style.removeProperty('display')
            formWrapper.style.removeProperty('display')
          }, 8 * 1000)
        }
      })
      .catch(console.error)
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
