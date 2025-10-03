'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info,
  Bug,
  Lock,
  Zap
} from 'lucide-react'

interface ResourceSafetyPanelProps {
  validationResult: {
    resourceSafety: {
      resourceLeaks: Array<{
        type: string
        location: string
        description: string
        severity: 'low' | 'medium' | 'high'
        suggestion: string
      }>
      unsafeOperations: Array<{
        operation: string
        location: string
        risk: string
        mitigation: string
        severity: 'low' | 'medium' | 'high'
      }>
      securityIssues: Array<{
        type: string
        description: string
        location: string
        severity: 'low' | 'medium' | 'high'
        cwe?: string
        recommendation: string
      }>
      recommendations: string[]
      overallSafety: 'safe' | 'warning' | 'unsafe'
    }
    overallRisk: 'low' | 'medium' | 'high'
    deploymentReady: boolean
  }
  securityAudit: {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    issues: {
      critical: number
      high: number
      medium: number
      low: number
    }
    recommendations: string[]
  }
}

export function ResourceSafetyPanel({ validationResult, securityAudit }: ResourceSafetyPanelProps) {
  const { resourceSafety, overallRisk, deploymentReady } = validationResult

  const getSafetyIcon = (safety: string) => {
    switch (safety) {
      case 'safe':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'unsafe':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Info className="h-5 w-5 text-gray-500" />
    }
  }

  const getSafetyColor = (safety: string) => {
    switch (safety) {
      case 'safe':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'unsafe':
        return 'text-red-700 bg-red-50 border-red-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'high':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    }
    
    return (
      <Badge variant="secondary" className={colors[severity]}>
        {severity.toUpperCase()}
      </Badge>
    )
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-600'
      case 'B':
        return 'text-blue-600'
      case 'C':
        return 'text-yellow-600'
      case 'D':
        return 'text-orange-600'
      case 'F':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Overall Safety Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Resource Safety Analysis
          </CardTitle>
          <CardDescription>
            Comprehensive analysis of resource lifecycle management and security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Safety Status */}
            <div className={`p-4 rounded-lg border ${getSafetyColor(resourceSafety.overallSafety)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getSafetyIcon(resourceSafety.overallSafety)}
                <span className="font-semibold">Safety Status</span>
              </div>
              <p className="text-sm capitalize">{resourceSafety.overallSafety}</p>
            </div>

            {/* Risk Level */}
            <div className="p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-gray-600" />
                <span className="font-semibold">Risk Level</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getRiskColor(overallRisk)}`} />
                <span className="text-sm capitalize">{overallRisk}</span>
              </div>
            </div>

            {/* Deployment Status */}
            <div className="p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-gray-600" />
                <span className="font-semibold">Deployment</span>
              </div>
              <div className="flex items-center gap-2">
                {deploymentReady ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  {deploymentReady ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Audit Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security Audit Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <div className={`text-4xl font-bold ${getGradeColor(securityAudit.grade)}`}>
                {securityAudit.grade}
              </div>
              <div className="text-sm text-gray-600">Grade</div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Security Score</span>
                <span className="text-sm text-gray-600">{securityAudit.score}/100</span>
              </div>
              <Progress value={securityAudit.score} className="h-2" />
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600">{securityAudit.issues.high}</div>
              <div className="text-xs text-gray-600">High</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{securityAudit.issues.medium}</div>
              <div className="text-xs text-gray-600">Medium</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{securityAudit.issues.low}</div>
              <div className="text-xs text-gray-600">Low</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{securityAudit.issues.critical}</div>
              <div className="text-xs text-gray-600">Critical</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="leaks" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="leaks" className="flex items-center gap-1">
                <Bug className="h-4 w-4" />
                Leaks ({resourceSafety.resourceLeaks.length})
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Operations ({resourceSafety.unsafeOperations.length})
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1">
                <Lock className="h-4 w-4" />
                Security ({resourceSafety.securityIssues.length})
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-1">
                <Info className="h-4 w-4" />
                Recommendations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaks" className="space-y-3">
              {resourceSafety.resourceLeaks.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>No Resource Leaks Detected</AlertTitle>
                  <AlertDescription>
                    All resources appear to be properly managed.
                  </AlertDescription>
                </Alert>
              ) : (
                resourceSafety.resourceLeaks.map((leak, index) => (
                  <Alert key={index}>
                    <Bug className="h-4 w-4" />
                    <AlertTitle className="flex items-center gap-2">
                      Resource Leak - {leak.location}
                      {getSeverityBadge(leak.severity)}
                    </AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">{leak.description}</p>
                      <p className="text-sm text-blue-600">
                        <strong>Suggestion:</strong> {leak.suggestion}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </TabsContent>

            <TabsContent value="operations" className="space-y-3">
              {resourceSafety.unsafeOperations.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>No Unsafe Operations Detected</AlertTitle>
                  <AlertDescription>
                    All operations appear to follow safety best practices.
                  </AlertDescription>
                </Alert>
              ) : (
                resourceSafety.unsafeOperations.map((operation, index) => (
                  <Alert key={index}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center gap-2">
                      Unsafe Operation - {operation.location}
                      {getSeverityBadge(operation.severity)}
                    </AlertTitle>
                    <AlertDescription>
                      <p className="mb-1"><strong>Operation:</strong> {operation.operation}</p>
                      <p className="mb-2"><strong>Risk:</strong> {operation.risk}</p>
                      <p className="text-sm text-blue-600">
                        <strong>Mitigation:</strong> {operation.mitigation}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </TabsContent>

            <TabsContent value="security" className="space-y-3">
              {resourceSafety.securityIssues.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>No Security Issues Detected</AlertTitle>
                  <AlertDescription>
                    Code follows security best practices.
                  </AlertDescription>
                </Alert>
              ) : (
                resourceSafety.securityIssues.map((issue, index) => (
                  <Alert key={index}>
                    <Lock className="h-4 w-4" />
                    <AlertTitle className="flex items-center gap-2">
                      Security Issue - {issue.location}
                      {getSeverityBadge(issue.severity)}
                      {issue.cwe && (
                        <Badge variant="outline" className="text-xs">
                          {issue.cwe}
                        </Badge>
                      )}
                    </AlertTitle>
                    <AlertDescription>
                      <p className="mb-1"><strong>Type:</strong> {issue.type.replace('_', ' ')}</p>
                      <p className="mb-2">{issue.description}</p>
                      <p className="text-sm text-blue-600">
                        <strong>Recommendation:</strong> {issue.recommendation}
                      </p>
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-3">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Recommendations</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {securityAudit.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}