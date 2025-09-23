/**
 * Shop Map Visualization Component using Kakao Maps
 * 
 * React component for displaying shop locations on Kakao Maps
 * with clustering, filtering, and interactive features
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { MapPin, Search, Filter, Layers } from 'lucide-react'

// Extend Window interface for Kakao Maps
declare global {
  interface Window {
    kakao: any;
  }
}

interface ShopMapProps {
  shops: Array<{
    id: string
    name: string
    address: string
    latitude: number
    longitude: number
    mainCategory: string
    phoneNumber?: string
    description?: string
    isOpen?: boolean
  }>
  onShopSelect?: (shop: any) => void
  className?: string
  height?: string
}

export function KakaoShopMap({ 
  shops, 
  onShopSelect, 
  className = '', 
  height = '500px' 
}: ShopMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const kakaoMapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [mapType, setMapType] = useState('roadmap')

  // Filter shops based on category and search
  const filteredShops = shops.filter(shop => {
    const categoryMatch = selectedCategory === 'all' || shop.mainCategory === selectedCategory
    const searchMatch = searchQuery === '' || 
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.address.toLowerCase().includes(searchQuery.toLowerCase())
    
    return categoryMatch && searchMatch && shop.latitude && shop.longitude
  })

  // Get unique categories for filter
  const categories = [...new Set(shops.map(shop => shop.mainCategory))]

  // Load Kakao Maps API
  useEffect(() => {
    const loadKakaoMaps = () => {
      if (window.kakao && window.kakao.maps) {
        setIsLoaded(true)
        return
      }

      const script = document.createElement('script')
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAPS_API_KEY}&autoload=false`
      script.onload = () => {
        window.kakao.maps.load(() => {
          setIsLoaded(true)
        })
      }
      script.onerror = () => console.error('Failed to load Kakao Maps API')
      document.head.appendChild(script)
    }

    loadKakaoMaps()
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || kakaoMapRef.current) return

    try {
      // Calculate center and bounds
      const validShops = filteredShops.filter(shop => shop.latitude && shop.longitude)
      
      let center = new window.kakao.maps.LatLng(37.5665, 126.9780) // Seoul default
      
      if (validShops.length > 0) {
        const avgLat = validShops.reduce((sum, shop) => sum + shop.latitude, 0) / validShops.length
        const avgLng = validShops.reduce((sum, shop) => sum + shop.longitude, 0) / validShops.length
        center = new window.kakao.maps.LatLng(avgLat, avgLng)
      }

      // Map options
      const mapOption = {
        center: center,
        level: 8 // Zoom level
      }

      // Initialize map
      kakaoMapRef.current = new window.kakao.maps.Map(mapRef.current, mapOption)

      console.log('🗺️ Kakao Map initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Kakao Map:', error)
    }
  }, [isLoaded, filteredShops])

  // Update markers when shops change
  useEffect(() => {
    if (!kakaoMapRef.current || !isLoaded) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Create category color mapping
    const categoryColors = {
      nail: '#FF6B6B',      // Red
      hair: '#4ECDC4',      // Teal
      eyelash: '#45B7D1',   // Blue
      waxing: '#96CEB4',    // Green
      eyebrow_tattoo: '#FFEAA7', // Yellow
      facial: '#DDA0DD',    // Plum
      massage: '#98D8C8'    // Mint
    }

    // Add markers for filtered shops
    filteredShops.forEach((shop, index) => {
      if (!shop.latitude || !shop.longitude) return

      const position = new window.kakao.maps.LatLng(shop.latitude, shop.longitude)
      const color = categoryColors[shop.mainCategory as keyof typeof categoryColors] || '#666666'

      // Create custom marker image
      const markerImageSrc = createMarkerImage(color, getCategoryIcon(shop.mainCategory))
      const markerImage = new window.kakao.maps.MarkerImage(
        markerImageSrc,
        new window.kakao.maps.Size(24, 24),
        {
          offset: new window.kakao.maps.Point(12, 12)
        }
      )

      const marker = new window.kakao.maps.Marker({
        position: position,
        map: kakaoMapRef.current,
        image: markerImage,
        title: shop.name
      })

      // Create info window content
      const infoContent = `
        <div style="padding: 15px; min-width: 250px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #333;">
            ${shop.name}
          </h3>
          <div style="margin: 8px 0; font-size: 13px; color: #666; line-height: 1.4;">
            <div style="margin: 4px 0;">
              📍 ${shop.address}
            </div>
            ${shop.phoneNumber ? `
              <div style="margin: 4px 0;">
                📞 <a href="tel:${shop.phoneNumber}" style="color: #007bff; text-decoration: none;">${shop.phoneNumber}</a>
              </div>
            ` : ''}
            <div style="margin: 4px 0;">
              🏪 ${shop.mainCategory}
            </div>
            ${shop.description ? `
              <div style="margin: 8px 0 4px 0; font-size: 12px; color: #888;">
                ${shop.description}
              </div>
            ` : ''}
          </div>
          <div style="margin-top: 10px; display: flex; gap: 8px;">
            <button 
              onclick="window.kakaoShopMapSelectShop && window.kakaoShopMapSelectShop('${shop.id}')"
              style="
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 4px; 
                font-size: 12px; 
                cursor: pointer;
              "
            >
              View Details
            </button>
            ${shop.phoneNumber ? `
              <button 
                onclick="window.open('tel:${shop.phoneNumber}')"
                style="
                  background: #28a745; 
                  color: white; 
                  border: none; 
                  padding: 6px 12px; 
                  border-radius: 4px; 
                  font-size: 12px; 
                  cursor: pointer;
                "
              >
                Call
              </button>
            ` : ''}
          </div>
        </div>
      `

      // Create info window
      const infoWindow = new window.kakao.maps.InfoWindow({
        content: infoContent,
        removable: true
      })

      // Add click event for marker
      window.kakao.maps.event.addListener(marker, 'click', () => {
        // Close other info windows
        markersRef.current.forEach(m => {
          if (m.infoWindow) m.infoWindow.close()
        })

        infoWindow.open(kakaoMapRef.current, marker)
        marker.infoWindow = infoWindow

        // Call onShopSelect if provided
        if (onShopSelect) {
          onShopSelect(shop)
        }
      })

      markersRef.current.push(marker)
    })

    // Fit map to show all markers
    if (filteredShops.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds()
      filteredShops.forEach(shop => {
        if (shop.latitude && shop.longitude) {
          bounds.extend(new window.kakao.maps.LatLng(shop.latitude, shop.longitude))
        }
      })
      kakaoMapRef.current.setBounds(bounds)
    }

    console.log(`🗺️ Added ${markersRef.current.length} markers to map`)
  }, [filteredShops, isLoaded, onShopSelect])

  // Set up global function for shop selection from info window
  useEffect(() => {
    window.kakaoShopMapSelectShop = (shopId: string) => {
      const shop = shops.find(s => s.id === shopId)
      if (shop && onShopSelect) {
        onShopSelect(shop)
      }
    }

    return () => {
      delete window.kakaoShopMapSelectShop
    }
  }, [shops, onShopSelect])

  const getCategoryIcon = (category: string) => {
    const icons = {
      nail: '💅',
      hair: '💇',
      eyelash: '👁️',
      waxing: '✨',
      eyebrow_tattoo: '🎨',
      facial: '🧴',
      massage: '💆'
    }
    return icons[category as keyof typeof icons] || '🏪'
  }

  const createMarkerImage = (color: string, icon: string) => {
    // Create a simple SVG marker
    const svg = `
      <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif">
          ${icon}
        </text>
      </svg>
    `
    
    return 'data:image/svg+xml;base64,' + btoa(svg)
  }

  const handleFitBounds = () => {
    if (!kakaoMapRef.current || filteredShops.length === 0) return

    const bounds = new window.kakao.maps.LatLngBounds()
    filteredShops.forEach(shop => {
      if (shop.latitude && shop.longitude) {
        bounds.extend(new window.kakao.maps.LatLng(shop.latitude, shop.longitude))
      }
    })
    kakaoMapRef.current.setBounds(bounds)
  }

  const handleMapTypeChange = (newMapType: string) => {
    if (!kakaoMapRef.current) return

    const mapTypeId = newMapType === 'satellite' 
      ? window.kakao.maps.MapTypeId.HYBRID 
      : window.kakao.maps.MapTypeId.ROADMAP

    kakaoMapRef.current.setMapTypeId(mapTypeId)
    setMapType(newMapType)
  }

  if (!isLoaded) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center" style={{ height }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading Kakao Maps...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Shop Locations ({filteredShops.length})
            </CardTitle>
            <CardDescription>
              Interactive map showing beauty shops with detailed information
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleFitBounds}>
              <Layers className="h-4 w-4 mr-2" />
              Fit All
            </Button>
          </div>
        </div>
        
        {/* Map Controls */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {getCategoryIcon(category)} {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={mapType} onValueChange={handleMapTypeChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Map Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roadmap">Road Map</SelectItem>
              <SelectItem value="satellite">Satellite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Legend */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => {
            const count = shops.filter(shop => shop.mainCategory === category).length
            return (
              <Badge 
                key={category} 
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(selectedCategory === category ? 'all' : category)}
              >
                {getCategoryIcon(category)} {category} ({count})
              </Badge>
            )
          })}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Map Container */}
        <div 
          ref={mapRef} 
          className="w-full rounded-lg border"
          style={{ height }}
        />
        
        {/* Map Statistics */}
        <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
          <div>
            Showing {filteredShops.length} of {shops.length} shops
          </div>
          <div className="flex gap-4">
            <span>📍 {filteredShops.filter(s => s.latitude && s.longitude).length} geocoded</span>
            <span>❓ {filteredShops.filter(s => !s.latitude || !s.longitude).length} missing coordinates</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Shop Map Container with API Integration
 */
interface ShopMapContainerProps {
  searchParams?: {
    category?: string
    location?: string
    radius?: number
  }
  onShopSelect?: (shop: any) => void
  className?: string
  height?: string
}

export function KakaoShopMapContainer({ 
  searchParams = {}, 
  onShopSelect, 
  className,
  height 
}: ShopMapContainerProps) {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShops()
  }, [searchParams])

  const fetchShops = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // This would call your service API
      const response = await fetch('/api/shops/search?' + new URLSearchParams({
        ...searchParams,
        includeCoordinates: 'true'
      } as any))
      
      const data = await response.json()
      
      if (data.success) {
        setShops(data.data.shops || [])
      } else {
        setError(data.error?.message || 'Failed to fetch shops')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center" style={{ height: height || '500px' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading shop locations...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center" style={{ height: height || '500px' }}>
          <div className="text-center">
            <p className="text-red-500 mb-4">Error loading shops: {error}</p>
            <Button onClick={fetchShops}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <KakaoShopMap 
      shops={shops}
      onShopSelect={onShopSelect}
      className={className}
      height={height}
    />
  )
}

/**
 * Admin Map Dashboard for visualizing all shops
 */
export function KakaoAdminShopMapDashboard() {
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [mapStats, setMapStats] = useState({
    totalShops: 0,
    geocodedShops: 0,
    pendingApproval: 0,
    activeShops: 0
  })

  const handleShopSelect = (shop: any) => {
    setSelectedShop(shop)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{mapStats.totalShops}</div>
            <div className="text-sm text-gray-600">Total Shops</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{mapStats.geocodedShops}</div>
            <div className="text-sm text-gray-600">With Coordinates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{mapStats.pendingApproval}</div>
            <div className="text-sm text-gray-600">Pending Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{mapStats.activeShops}</div>
            <div className="text-sm text-gray-600">Active Shops</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <KakaoShopMapContainer 
            onShopSelect={handleShopSelect}
            height="600px"
          />
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Shop Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedShop ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">{selectedShop.name}</h3>
                    <p className="text-sm text-gray-600">{selectedShop.address}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Category:</span>
                      <Badge>{selectedShop.mainCategory}</Badge>
                    </div>
                    
                    {selectedShop.phoneNumber && (
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <a href={`tel:${selectedShop.phoneNumber}`} className="text-blue-600">
                          {selectedShop.phoneNumber}
                        </a>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge variant={selectedShop.isOpen ? "default" : "secondary"}>
                        {selectedShop.isOpen ? 'Open' : 'Closed'}
                      </Badge>
                    </div>
                    
                    {selectedShop.latitude && selectedShop.longitude && (
                      <div className="text-xs text-gray-500">
                        📍 {selectedShop.latitude.toFixed(6)}, {selectedShop.longitude.toFixed(6)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      Edit Shop
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      View Reservations
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Click on a map marker to view shop details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default KakaoShopMap
