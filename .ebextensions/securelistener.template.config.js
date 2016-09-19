// @if SSL='true'
option_settings:
  aws:elb:listener:443:
    ListenerProtocol: HTTPS
    SSLCertificateId: arn:aws:acm:eu-west-1:470576480462:certificate/80a72a7c-5aff-494b-ae35-ff5bc6896831
    InstancePort: 80
    InstanceProtocol: HTTP
  aws:elb:listener:80:
    ListenerEnabled: true
    ListenerProtocol: HTTP
    InstancePort: 80
    InstanceProtocol: HTTP
// @endif
