import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle, Info, ExternalLink, FileText, PieChart, Layout, Layers } from 'lucide-react';

const SEOVisualAnalysis = () => {
  const [openSections, setOpenSections] = useState({
    'overview': true,
    'headingStructure': false,
    'metaTags': false,
    'recommendations': false
  });

  const toggleSection = (section) => {
    setOpenSections({
      ...openSections,
      [section]: !openSections[section]
    });
  };

  // SEO Metrics Data
  const seoMetrics = {
    overallScore: 65,
    metaTitle: {
      score: 70,
      issues: ['Generic wording', 'Lacks keywords'],
      recommendations: ['Add unique selling points', 'Include primary keywords']
    },
    metaDescription: {
      score: 60,
      issues: ['Missing on What\'s On page', 'Homepage description is generic'],
      recommendations: ['Add description to What\'s On page', 'Enhance homepage description with USPs']
    },
    headings: {
      score: 50,
      issues: ['Missing H1 on homepage', 'Excessive navigation H2s', 'Poor keyword usage'],
      recommendations: ['Add H1 to homepage', 'Restructure heading hierarchy', 'Include keywords in headings']
    },
    openGraph: {
      score: 40,
      issues: ['Missing og:title', 'Missing og:description', 'Non-optimized og:image'],
      recommendations: ['Implement complete OG tags', 'Optimize image dimensions']
    },
    twitterCards: {
      score: 0,
      issues: ['Completely missing Twitter Card metadata'],
      recommendations: ['Add twitter:card', 'Add twitter:title, description, image']
    },
    canonical: {
      score: 100,
      issues: [],
      recommendations: []
    }
  };

  // Heading structure data
  const headingStructure = {
    homepage: {
      url: 'https://www.sydneyoperahouse.com/',
      h1: {
        count: 0,
        content: []
      },
      h2: {
        count: 11,
        content: ['Main navigation', 'Your account', 'Sydney Opera House home page', 'Header navigation', 'Nothing quite like it']
      },
      h3: {
        count: 31,
        content: ['New to the House?', 'ANOHNI and the Johnsons', 'Nijinsky', 'Sydney Symphony Orchestra', 'You Are Here']
      }
    },
    visit: {
      url: 'https://www.sydneyoperahouse.com/visit',
      h1: {
        count: 1,
        content: ['Visit']
      },
      h2: {
        count: 7,
        content: ['Main navigation', 'Your account', 'Sydney Opera House home page', 'Header navigation', 'Breadcrumb']
      },
      h3: {
        count: 'Not analyzed',
        content: []
      }
    },
    whatsOn: {
      url: 'https://www.sydneyoperahouse.com/whats-on',
      h1: {
        count: 1,
        content: ['What\'s on']
      },
      h2: {
        count: 19,
        content: ['Main navigation', 'Your account', 'Sydney Opera House home page', 'Header navigation', 'Breadcrumb']
      },
      h3: {
        count: 'Not analyzed',
        content: []
      }
    }
  };

  // Meta tags data
  const metaTags = {
    homepage: {
      title: 'Home | Sydney Opera House',
      description: 'With over 40 shows a week there\'s something for everyone at the Sydney Opera House. Events, tours, food and drink – find out what\'s on.',
      canonical: 'https://www.sydneyoperahouse.com/',
      openGraph: {
        title: 'Missing',
        description: 'Missing',
        image: 'Present (not optimized)'
      },
      twitterCards: {
        card: 'Missing',
        title: 'Missing',
        description: 'Missing',
        image: 'Missing'
      }
    },
    visit: {
      title: 'Visit | Sydney Opera House',
      description: 'Plan your visit to the Sydney Opera House, a UNESCO World Heritage Site and Australia\'s icon. Step inside for a tour or performance today. There\'s nothing quite like it.',
      canonical: 'https://www.sydneyoperahouse.com/visit',
      openGraph: {
        title: 'Missing',
        description: 'Missing',
        image: 'Not analyzed'
      },
      twitterCards: {
        card: 'Missing',
        title: 'Missing',
        description: 'Missing',
        image: 'Missing'
      }
    },
    whatsOn: {
      title: 'What\'s on | Sydney Opera House',
      description: 'Missing',
      canonical: 'https://www.sydneyoperahouse.com/whats-on',
      openGraph: {
        title: 'Missing',
        description: 'Missing',
        image: 'Not analyzed'
      },
      twitterCards: {
        card: 'Missing',
        title: 'Missing',
        description: 'Missing',
        image: 'Missing'
      }
    }
  };

  // Recommended heading structure
  const recommendedHeadings = {
    homepage: {
      h1: ['Sydney Opera House - Australia\'s Iconic Cultural Landmark'],
      h2: [
        'Upcoming Events & Performances',
        'Plan Your Visit',
        'About the Sydney Opera House',
        'Explore Our Venues'
      ],
      h3: [
        'Featured Events',
        'Guided Tours',
        'Dining Options',
        'UNESCO World Heritage Site',
        'Architecture & Design'
      ]
    },
    visit: {
      h1: ['Visit the Sydney Opera House'],
      h2: [
        'Tours & Experiences',
        'Opening Hours',
        'Getting Here',
        'Accessibility Information',
        'Facilities & Services'
      ],
      h3: [
        'Guided Tour Options',
        'Ticket Information',
        'Transport & Parking',
        'Restaurants & Bars',
        'Visitor Safety Information'
      ]
    },
    whatsOn: {
      h1: ['What\'s On at Sydney Opera House'],
      h2: [
        'Upcoming Performances',
        'Events Calendar',
        'Featured Artists',
        'Festival Highlights',
        'Family Events'
      ],
      h3: [
        'Theater Performances',
        'Music Concerts',
        'Opera & Ballet',
        'Comedy Shows',
        'Talk & Ideas Events'
      ]
    }
  };

  // Helper function for score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Component for score display
  const ScoreIndicator = ({ score, size = 'medium' }) => {
    const sizeClass = size === 'large' ? 'w-32 h-32 text-4xl' : 'w-16 h-16 text-xl';
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center ${getScoreColor(score)} border-4 border-current`}>
        {score}
      </div>
    );
  };

  // Component for issues and recommendations
  const IssuesRecommendations = ({ issues, recommendations }) => {
    return (
      <div className="mt-2">
        {issues.length > 0 && (
          <div className="mb-2">
            <div className="font-semibold flex items-center gap-1 text-red-600">
              <AlertCircle size={16} />
              <span>Issues:</span>
            </div>
            <ul className="ml-6 list-disc">
              {issues.map((issue, i) => (
                <li key={i} className="text-sm">{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {recommendations.length > 0 && (
          <div>
            <div className="font-semibold flex items-center gap-1 text-green-600">
              <CheckCircle size={16} />
              <span>Recommendations:</span>
            </div>
            <ul className="ml-6 list-disc">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-sm">{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 font-sans bg-gray-50 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">Sydney Opera House - SEO Visual Analysis</h1>
      
      {/* Overview Section */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer flex justify-between items-center bg-blue-50"
          onClick={() => toggleSection('overview')}
        >
          <div className="flex items-center gap-2">
            <PieChart className="text-blue-600" />
            <h2 className="text-xl font-semibold">Overall SEO Metrics</h2>
          </div>
          {openSections.overview ? <ChevronUp /> : <ChevronDown />}
        </div>
        
        {openSections.overview && (
          <div className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-around mb-6">
              <div className="flex flex-col items-center mb-4 md:mb-0">
                <ScoreIndicator score={seoMetrics.overallScore} size="large" />
                <div className="mt-2 font-semibold">Overall SEO Score</div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="flex flex-col items-center">
                  <ScoreIndicator score={seoMetrics.metaTitle.score} />
                  <div className="mt-1 text-sm font-medium">Meta Title</div>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreIndicator score={seoMetrics.metaDescription.score} />
                  <div className="mt-1 text-sm font-medium">Meta Description</div>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreIndicator score={seoMetrics.headings.score} />
                  <div className="mt-1 text-sm font-medium">Headings</div>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreIndicator score={seoMetrics.openGraph.score} />
                  <div className="mt-1 text-sm font-medium">Open Graph</div>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreIndicator score={seoMetrics.twitterCards.score} />
                  <div className="mt-1 text-sm font-medium">Twitter Cards</div>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreIndicator score={seoMetrics.canonical.score} />
                  <div className="mt-1 text-sm font-medium">Canonical</div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-2">
              <Info className="text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Summary of Key Issues:</p>
                <ul className="list-disc ml-5 mt-1">
                  <li>Missing H1 tag on homepage (critical SEO issue)</li>
                  <li>Incomplete meta descriptions across pages</li>
                  <li>Missing social sharing metadata (Open Graph, Twitter Cards)</li>
                  <li>Generic title tags lacking keywords</li>
                  <li>Improper heading hierarchy with excessive navigation headings</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Heading Structure Section */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer flex justify-between items-center bg-blue-50"
          onClick={() => toggleSection('headingStructure')}
        >
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" />
            <h2 className="text-xl font-semibold">Heading Structure Analysis</h2>
          </div>
          {openSections.headingStructure ? <ChevronUp /> : <ChevronDown />}
        </div>
        
        {openSections.headingStructure && (
          <div className="p-4">
            <div className="mb-6">
              <IssuesRecommendations 
                issues={seoMetrics.headings.issues}
                recommendations={seoMetrics.headings.recommendations}
              />
            </div>
            
            <div className="space-y-6">
              {Object.entries(headingStructure).map(([page, data]) => (
                <div key={page} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-3 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold capitalize">{page} Page</h3>
                      <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm flex items-center gap-1">
                        <span>View page</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="mb-4">
                      <div className="flex flex-col">
                        <div className="flex items-center mb-2">
                          <div className="w-16 font-bold">H1</div>
                          <div className="ml-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${data.h1.count === 0 ? 'bg-red-100 text-red-800' : data.h1.count === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {data.h1.count} {data.h1.count === 1 ? 'tag' : 'tags'}
                            </span>
                          </div>
                        </div>
                        
                        {data.h1.count === 0 ? (
                          <div className="ml-16 flex items-center text-red-600 text-sm">
                            <AlertCircle size={14} className="mr-1" />
                            <span>Missing H1 tag - Critical SEO issue</span>
                          </div>
                        ) : (
                          <div className="ml-16">
                            <ul className="list-disc ml-4 text-sm">
                              {data.h1.content.map((text, i) => (
                                <li key={i}>{text}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex flex-col">
                        <div className="flex items-center mb-2">
                          <div className="w-16 font-bold">H2</div>
                          <div className="ml-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${data.h2.count > 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {data.h2.count} tags
                            </span>
                          </div>
                        </div>
                        
                        {data.h2.count > 10 && (
                          <div className="ml-16 flex items-center text-yellow-600 text-sm mb-2">
                            <AlertCircle size={14} className="mr-1" />
                            <span>Excessive H2 tags may dilute SEO focus</span>
                          </div>
                        )}
                        
                        <div className="ml-16">
                          <ul className="list-disc ml-4 text-sm">
                            {data.h2.content.map((text, i) => (
                              <li key={i} className={text.includes('navigation') || text.includes('account') ? 'text-gray-500' : ''}>
                                {text}
                                {(text.includes('navigation') || text.includes('account')) && 
                                  <span className="text-gray-500 text-xs ml-2">(UI element)</span>
                                }
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    {data.h3.count !== 'Not analyzed' && (
                      <div>
                        <div className="flex flex-col">
                          <div className="flex items-center mb-2">
                            <div className="w-16 font-bold">H3</div>
                            <div className="ml-2">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                {data.h3.count} tags
                              </span>
                            </div>
                          </div>
                          
                          <div className="ml-16">
                            <ul className="list-disc ml-4 text-sm">
                              {data.h3.content.map((text, i) => (
                                <li key={i}>{text}</li>
                              ))}
                              {data.h3.content.length < data.h3.count && (
                                <li className="text-gray-500">... and {data.h3.count - data.h3.content.length} more</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Meta Tags Section */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer flex justify-between items-center bg-blue-50"
          onClick={() => toggleSection('metaTags')}
        >
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" />
            <h2 className="text-xl font-semibold">Meta Tags Analysis</h2>
          </div>
          {openSections.metaTags ? <ChevronUp /> : <ChevronDown />}
        </div>
        
        {openSections.metaTags && (
          <div className="p-4">
            <div className="space-y-6">
              {Object.entries(metaTags).map(([page, data]) => (
                <div key={page} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-3 border-b">
                    <h3 className="font-semibold capitalize">{page} Page</h3>
                  </div>
                  
                  <div className="p-4">
                    <div className="space-y-4">
                      <div>
                        <div className="font-medium mb-1">Title Tag:</div>
                        <div className="p-2 bg-gray-50 rounded border text-sm">{data.title}</div>
                        <div className="mt-1 text-xs text-gray-500 flex items-center">
                          <span>{data.title.length} characters</span>
                          {data.title.length < 30 && (
                            <span className="ml-2 flex items-center text-yellow-600">
                              <AlertCircle size={12} className="mr-1" />
                              Too short (recommend 50-60 chars)
                            </span>
                          )}
                          {data.title.length > 60 && (
                            <span className="ml-2 flex items-center text-yellow-600">
                              <AlertCircle size={12} className="mr-1" />
                              Too long (recommend 50-60 chars)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium mb-1">Meta Description:</div>
                        {data.description === 'Missing' ? (
                          <div className="p-2 bg-red-50 rounded border border-red-200 text-sm flex items-center">
                            <AlertCircle size={14} className="text-red-600 mr-2" />
                            <span className="text-red-600">Missing - Critical SEO issue</span>
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded border text-sm">{data.description}</div>
                        )}
                        {data.description !== 'Missing' && (
                          <div className="mt-1 text-xs text-gray-500 flex items-center">
                            <span>{data.description.length} characters</span>
                            {data.description.length < 120 && (
                              <span className="ml-2 flex items-center text-yellow-600">
                                <AlertCircle size={12} className="mr-1" />
                                Too short (recommend 120-155 chars)
                              </span>
                            )}
                            {data.description.length > 155 && (
                              <span className="ml-2 flex items-center text-yellow-600">
                                <AlertCircle size={12} className="mr-1" />
                                Too long (recommend 120-155 chars)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <div className="font-medium mb-1">Canonical URL:</div>
                        <div className="p-2 bg-gray-50 rounded border text-sm">{data.canonical}</div>
                      </div>
                      
                      <div>
                        <div className="font-medium mb-1">Open Graph Tags:</div>
                        <div className="ml-4 space-y-2">
                          <div className="flex">
                            <div className="w-24 text-sm">og:title:</div>
                            <div className={`text-sm ${data.openGraph.title === 'Missing' ? 'text-red-600 font-medium' : ''}`}>
                              {data.openGraph.title}
                            </div>
                          </div>
                          <div className="flex">
                            <div className="w-24 text-sm">og:description:</div>
                            <div className={`text-sm ${data.openGraph.description === 'Missing' ? 'text-red-600 font-medium' : ''}`}>
                              {data.openGraph.description}
                            </div>
                          </div>
                          <div className="flex">
                            <div className="w-24 text-sm">og:image:</div>
                            <div className="text-sm">{data.openGraph.image}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium mb-1">Twitter Card Tags:</div>
                        <div className="ml-4 space-y-2">
                          <div className="flex">
                            <div className="w-24 text-sm">twitter:card:</div>
                            <div className={`text-sm ${data.twitterCards.card === 'Missing' ? 'text-red-600 font-medium' : ''}`}>
                              {data.twitterCards.card}
                            </div>
                          </div>
                          <div className="flex">
                            <div className="w-24 text-sm">twitter:title:</div>
                            <div className={`text-sm ${data.twitterCards.title === 'Missing' ? 'text-red-600 font-medium' : ''}`}>
                              {data.twitterCards.title}
                            </div>
                          </div>
                          <div className="flex">
                            <div className="w-24 text-sm">twitter:desc:</div>
                            <div className={`text-sm ${data.twitterCards.description === 'Missing' ? 'text-red-600 font-medium' : ''}`}>
                              {data.twitterCards.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Recommendations Section */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div 
          className="p-4 border-b cursor-pointer flex justify-between items-center bg-blue-50"
          onClick={() => toggleSection('recommendations')}
        >
          <div className="flex items-center gap-2">
            <Layout className="text-blue-600" />
            <h2 className="text-xl font-semibold">Recommended Heading Structure</h2>
          </div>
          {openSections.recommendations ? <ChevronUp /> : <ChevronDown />}
        </div>
        
        {openSections.recommendations && (
          <div className="p-4">
            <div className="space-y-6">
              {Object.entries(recommendedHeadings).map(([page, data]) => (
                <div key={page} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-3 border-b">
                    <h3 className="font-semibold capitalize">Recommended {page} Page Structure</h3>
                  </div>
                  
                  <div className="p-4">
                    <div className="space-y-6">
                      <div>
                        <div className="font-medium mb-2 flex items-center">
                          <div className="w-12 h-8 bg-blue-600 text-white flex items-center justify-center text-sm font-bold rounded">H1</div>
                          <div className="ml-3 text-blue-600">(1 tag only)</div>
                        </div>
                        <div className="ml-4 p-3 bg-blue-50 rounded border border-blue-100">
                          {data.h1[0]}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium mb-2 flex items-center">
                          <div className="w-12 h-8 bg-green-600 text-white flex items-center justify-center text-sm font-bold rounded">H2</div>
                          <div className="ml-3 text-green-600">(Main sections)</div>
                        </div>
                        <div className="ml-4 space-y-2">
                          {data.h2.map((heading, i) => (
                            <div key={i} className="p-2 bg-green-50 rounded border border-green-100">
                              {heading}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium mb-2 flex items-center">
                          <div className="w-12 h-8 bg-yellow-600 text-white flex items-center justify-center text-sm font-bold rounded">H3</div>
                          <div className="ml-3 text-yellow-600">(Subsections)</div>
                        </div>
                        <div className="ml-4 space-y-2">
                          {data.h3.map((heading, i) => (
                            <div key={i} className="p-2 bg-yellow-50 rounded border border-yellow-100">
                              {heading}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Key Best Practices for Heading Structure:</h3>
              <ul className="list-disc ml-5 space-y-1">
                <li>Use only one H1 tag per page that includes your primary keyword</li>
                <li>Follow a hierarchical structure (H1 → H2 → H3)</li>
                <li>Ensure headings accurately describe the content that follows</li>
                <li>Include relevant keywords in headings but avoid keyword stuffing</li>
                <li>Don't use heading tags for styling purposes</li>
                <li>Keep heading text concise and descriptive</li>
                <li>Avoid using the same heading text across multiple pages</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      
      <div className="text-center text-sm text-gray-500 mt-8">
        <p>This analysis was created on April 22, 2025</p>
        <p className="mt-1">Data based on SEO audit of Sydney Opera House website</p>
      </div>
    </div>
  );
};

export default SEOVisualAnalysis;